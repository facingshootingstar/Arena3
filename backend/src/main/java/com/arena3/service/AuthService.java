package com.arena3.service;

import com.arena3.entity.OutboxEntity;
import com.arena3.entity.SessionAuthEntity;
import com.arena3.entity.SubscriptionEntity;
import com.arena3.entity.UserEntity;
import com.arena3.exception.ApiException;
import com.arena3.repository.MembershipPlanRepository;
import com.arena3.repository.OutboxRepository;
import com.arena3.repository.SessionAuthRepository;
import com.arena3.repository.SubscriptionRepository;
import com.arena3.repository.UserRepository;
import com.arena3.security.ScryptPasswordEncoder;
import com.arena3.security.SecurityUtils;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.Period;
import java.time.ZoneId;
import java.util.*;

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final SessionAuthRepository sessionAuthRepository;
    private final SubscriptionRepository subscriptionRepository;
    private final OutboxRepository outboxRepository;
    private final MembershipPlanRepository membershipPlanRepository;
    private final ScryptPasswordEncoder passwordEncoder;

    public AuthService(UserRepository userRepository,
                       SessionAuthRepository sessionAuthRepository,
                       SubscriptionRepository subscriptionRepository,
                       MembershipPlanRepository membershipPlanRepository,
                       OutboxRepository outboxRepository,
                       ScryptPasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.sessionAuthRepository = sessionAuthRepository;
        this.subscriptionRepository = subscriptionRepository;
        this.membershipPlanRepository = membershipPlanRepository;
        this.outboxRepository = outboxRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Transactional
    public Map<String, Object> login(String login, String password) {
        if (login == null || password == null) {
            throw ApiException.validation("Thiếu thông tin đăng nhập.");
        }
        String normalizedPhone = SecurityUtils.normalizePhone(login);
        UserEntity user = userRepository.findByLogin(normalizedPhone)
                .or(() -> userRepository.findByLogin(login))
                .orElseThrow(() -> ApiException.unauth("Tài khoản hoặc mật khẩu không chính xác."));

        if (!passwordEncoder.matches(password, user.getPasswordHash())) {
            user.setFailedLogins(user.getFailedLogins() + 1);
            userRepository.save(user);
            throw ApiException.unauth("Tài khoản hoặc mật khẩu không chính xác.");
        }

        if (!"active".equalsIgnoreCase(user.getStatus())) {
            throw ApiException.unauth("Tài khoản đang bị khóa hoặc ngừng hoạt động.");
        }

        user.setFailedLogins(0);
        userRepository.save(user);

        String token = SecurityUtils.randomToken(32);
        String tokenHash = SecurityUtils.sha256(token);
        int hours = "member".equalsIgnoreCase(user.getRole()) ? 24 * 7 : 12;
        OffsetDateTime expires = OffsetDateTime.now().plusHours(hours);

        SessionAuthEntity session = new SessionAuthEntity();
        session.setUserId(user.getId());
        session.setTokenHash(tokenHash);
        session.setExpiresAt(expires);
        sessionAuthRepository.save(session);

        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("token", token);
        resp.put("expires_at", expires.toString());
        resp.put("user", toUserDto(user));
        return resp;
    }

    @Transactional
    public Map<String, Object> register(Map<String, Object> body) {
        String fullName = (String) body.get("full_name");
        String phone = SecurityUtils.normalizePhone((String) body.get("phone"));
        String password = (String) body.get("password");
        String dob = (String) body.get("dob");
        String email = (String) body.get("email");

        if (fullName == null || fullName.trim().isEmpty()) throw ApiException.validation("Thiếu họ tên.");
        if (phone.length() < 9) throw ApiException.validation("Số điện thoại không hợp lệ.");
        if (password == null || password.length() < 8) {
            throw ApiException.br("BR-02", "Mật khẩu tối thiểu 8 ký tự, gồm chữ và số.");
        }
        if (!Boolean.TRUE.equals(body.get("pii_consent"))) {
            throw ApiException.br("BR-08", "Cần đồng ý điều khoản và NĐ 13/2023.");
        }

        if (dob != null) {
            try {
                LocalDate birth = LocalDate.parse(dob);
                int age = Period.between(birth, LocalDate.now()).getYears();
                if (age < 16 && (body.get("guardian_name") == null || body.get("guardian_phone") == null)) {
                    throw ApiException.br("BR-07", "Người chưa thành niên cần thông tin giám hộ.");
                }
            } catch (Exception ignored) {}
        }

        if (userRepository.findByPhone(phone).isPresent()) {
            throw ApiException.br("BR-01", "Số điện thoại đã có tài khoản.");
        }

        String otp = String.valueOf((int) (100000 + Math.random() * 900000));
        UUID challengeId = UUID.randomUUID();

        Map<String, Object> res = new LinkedHashMap<>();
        res.put("challenge_id", challengeId.toString());
        res.put("otp", otp);
        res.put("staging", true);
        res.put("message", "OTP (môi trường thử) — nhập để xác thực.");
        return res;
    }

    @Transactional
    public Map<String, Object> verifyOtp(Map<String, Object> body) {
        String phone = SecurityUtils.normalizePhone((String) body.get("phone"));
        String fullName = (String) body.getOrDefault("full_name", "Hội viên");
        String password = (String) body.getOrDefault("password", "ChangeMe!a3");

        UserEntity user = new UserEntity();
        user.setFullName(fullName);
        user.setNameNormalized(SecurityUtils.unaccentVi(fullName));
        user.setPhone(phone);
        user.setRole("member");
        user.setStatus("active");
        user.setPasswordHash(passwordEncoder.encode(password));
        user.setCreatedAt(OffsetDateTime.now());
        user = userRepository.save(user);

        return login(phone, password);
    }

    @Transactional
    public void logout(String token) {
        if (token != null) {
            sessionAuthRepository.deleteByTokenHash(SecurityUtils.sha256(token));
        }
    }

    public Map<String, Object> getMe(UserEntity user) {
        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("user", toUserDto(user));

        List<SubscriptionEntity> subs = subscriptionRepository.findByUserId(user.getId());
        List<Map<String, Object>> enrichedSubs = new ArrayList<>();
        for (SubscriptionEntity s : subs) {
            Map<String, Object> sm = new LinkedHashMap<>();
            sm.put("id", s.getId().toString());
            sm.put("plan_id", s.getPlanId().toString());
            sm.put("sport_scope", s.getSportScope());
            sm.put("start_on", s.getStartOn() != null ? s.getStartOn().toString() : null);
            sm.put("end_on", s.getEndOn() != null ? s.getEndOn().toString() : null);
            sm.put("status", s.getStatus());
            sm.put("court_hours_left", s.getCourtHoursLeft());
            sm.put("session_left", s.getSessionLeft());
            membershipPlanRepository.findById(s.getPlanId()).ifPresent(p -> {
                sm.put("plan_name", p.getName());
                sm.put("court_discount_pct", p.getCourtDiscountPct());
            });
            enrichedSubs.add(sm);
        }
        resp.put("subscriptions", enrichedSubs);

        List<OutboxEntity> inbox = outboxRepository.findByUserIdAndChannelAndSentAtIsNotNull(user.getId(), "inapp");
        resp.put("inbox", inbox);

        Map<String, Object> today = new LinkedHashMap<>();
        today.put("bookings", Collections.emptyList());
        today.put("classes", Collections.emptyList());
        resp.put("today", today);
        resp.put("offers", Collections.emptyList());
        resp.put("enrollments", Collections.emptyList());

        return resp;
    }

    @Transactional
    public Map<String, Object> patchMe(UserEntity user, Map<String, Object> body) {
        if (body.containsKey("full_name")) {
            String name = (String) body.get("full_name");
            user.setFullName(name);
            user.setNameNormalized(SecurityUtils.unaccentVi(name));
        }
        if (body.containsKey("email")) {
            user.setEmail((String) body.get("email"));
        }
        if (body.containsKey("health_notes")) {
            user.setHealthNotes((String) body.get("health_notes"));
        }
        userRepository.save(user);
        return getMe(user);
    }

    public Map<String, Object> toUserDto(UserEntity u) {
        Map<String, Object> dto = new LinkedHashMap<>();
        dto.put("id", u.getId().toString());
        dto.put("member_code", u.getMemberCode());
        dto.put("full_name", u.getFullName());
        dto.put("phone", u.getPhone());
        dto.put("email", u.getEmail());
        dto.put("role", u.getRole());
        dto.put("status", u.getStatus());
        dto.put("date_of_birth", u.getDateOfBirth() != null ? u.getDateOfBirth().toString() : null);
        dto.put("health_notes", u.getHealthNotes());
        dto.put("must_change_password", u.isMustChangePassword());
        return dto;
    }
}
