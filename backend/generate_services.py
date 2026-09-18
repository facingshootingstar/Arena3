import os

BASE = os.path.dirname(os.path.abspath(__file__))
JAVA = os.path.join(BASE, "src", "main", "java", "com", "arena3")

def w(path, content):
    p = os.path.join(JAVA, path)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    with open(p, "w", encoding="utf-8") as f:
        f.write(content.strip() + "\n")
    print("Wrote:", path)

w("service/PricingService.java", """
package com.arena3.service;

import com.arena3.entity.PriceRuleEntity;
import com.arena3.entity.SubscriptionEntity;
import com.arena3.repository.MembershipPlanRepository;
import com.arena3.repository.PriceRuleRepository;
import com.arena3.repository.SubscriptionRepository;
import lombok.Getter;
import lombok.Setter;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.UUID;

@Service
public class PricingService {

    private final PriceRuleRepository priceRuleRepository;
    private final SubscriptionRepository subscriptionRepository;
    private final MembershipPlanRepository membershipPlanRepository;

    public PricingService(PriceRuleRepository priceRuleRepository,
                          SubscriptionRepository subscriptionRepository,
                          MembershipPlanRepository membershipPlanRepository) {
        this.priceRuleRepository = priceRuleRepository;
        this.subscriptionRepository = subscriptionRepository;
        this.membershipPlanRepository = membershipPlanRepository;
    }

    @Getter
    @Setter
    public static class PriceResult {
        private int priceVnd;
        private boolean isPeak;
    }

    @Getter
    @Setter
    public static class DiscountResult {
        private int pct;
        private BigDecimal courtHoursLeft = BigDecimal.ZERO;
        private UUID subId;
    }

    public PriceResult lookupPrice(String sport, UUID courtId, OffsetDateTime start) {
        DayOfWeek dow = start.atZoneSameInstant(ZoneId.of("Asia/Ho_Chi_Minh")).getDayOfWeek();
        String dayKind = (dow == DayOfWeek.SATURDAY || dow == DayOfWeek.SUNDAY) ? "weekend" : "weekday";
        int minutes = start.getHour() * 60 + start.getMinute();

        List<PriceRuleEntity> rules = priceRuleRepository.findMatchingRules(sport, dayKind, minutes);
        PriceRuleEntity match = null;
        for (PriceRuleEntity r : rules) {
            if (courtId != null && courtId.equals(r.getCourtId())) {
                match = r;
                break;
            }
        }
        if (match == null) {
            for (PriceRuleEntity r : rules) {
                if (r.getCourtId() == null) {
                    match = r;
                    break;
                }
            }
        }

        PriceResult res = new PriceResult();
        if (match != null) {
            res.setPriceVnd(match.getPriceVnd());
            res.setPeak(match.isPeak());
        } else {
            res.setPriceVnd(100000);
            res.setPeak(false);
        }
        return res;
    }

    public DiscountResult memberDiscount(UUID userId, String sport) {
        DiscountResult res = new DiscountResult();
        if (userId == null) return res;

        LocalDate today = LocalDate.now(ZoneId.of("Asia/Ho_Chi_Minh"));
        List<SubscriptionEntity> subs = subscriptionRepository.findByUserIdAndStatus(userId, "active");
        for (SubscriptionEntity s : subs) {
            if (!s.getEndOn().isBefore(today)) {
                if ("all".equalsIgnoreCase(s.getSportScope()) || sport.equalsIgnoreCase(s.getSportScope())) {
                    membershipPlanRepository.findById(s.getPlanId()).ifPresent(p -> {
                        res.setPct(p.getCourtDiscountPct());
                    });
                    res.setCourtHoursLeft(s.getCourtHoursLeft());
                    res.setSubId(s.getId());
                    break;
                }
            }
        }
        return res;
    }

    public int applyDiscount(int list, int pct, int round) {
        if (pct <= 0) return list;
        double net = list * (1.0 - (double) pct / 100.0);
        return (int) (Math.round(net / round) * round);
    }
}
""")

w("service/AuthService.java", """
package com.arena3.service;

import com.arena3.entity.OutboxEntity;
import com.arena3.entity.SessionAuthEntity;
import com.arena3.entity.SubscriptionEntity;
import com.arena3.entity.UserEntity;
import com.arena3.exception.ApiException;
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
    private final ScryptPasswordEncoder passwordEncoder;

    public AuthService(UserRepository userRepository,
                       SessionAuthRepository sessionAuthRepository,
                       SubscriptionRepository subscriptionRepository,
                       OutboxRepository outboxRepository,
                       ScryptPasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.sessionAuthRepository = sessionAuthRepository;
        this.subscriptionRepository = subscriptionRepository;
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
        resp.put("subscriptions", subs);

        List<OutboxEntity> inbox = outboxRepository.findByUserIdAndChannelAndSentAtIsNotNull(user.getId(), "inapp");
        resp.put("inbox", inbox);
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
""")

w("service/CourtBookingService.java", """
package com.arena3.service;

import com.arena3.entity.CourtBookingEntity;
import com.arena3.entity.CourtEntity;
import com.arena3.entity.OccupancyEntity;
import com.arena3.entity.UserEntity;
import com.arena3.exception.ApiException;
import com.arena3.repository.CourtBookingRepository;
import com.arena3.repository.CourtRepository;
import com.arena3.repository.OccupancyRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.*;

@Service
public class CourtBookingService {

    private final CourtRepository courtRepository;
    private final OccupancyRepository occupancyRepository;
    private final CourtBookingRepository courtBookingRepository;
    private final PricingService pricingService;

    public CourtBookingService(CourtRepository courtRepository,
                               OccupancyRepository occupancyRepository,
                               CourtBookingRepository courtBookingRepository,
                               PricingService pricingService) {
        this.courtRepository = courtRepository;
        this.occupancyRepository = occupancyRepository;
        this.courtBookingRepository = courtBookingRepository;
        this.pricingService = pricingService;
    }

    public List<CourtEntity> getCourts() {
        return courtRepository.findAll();
    }

    public Map<String, Object> getOccupancy(String dateStr) {
        LocalDate date = (dateStr != null && !dateStr.isEmpty())
                ? LocalDate.parse(dateStr)
                : LocalDate.now(ZoneId.of("Asia/Ho_Chi_Minh"));

        OffsetDateTime startOfDay = date.atStartOfDay(ZoneId.of("Asia/Ho_Chi_Minh")).toOffsetDateTime();
        OffsetDateTime endOfDay = startOfDay.plusDays(1);

        List<CourtEntity> courts = courtRepository.findAll();
        List<OccupancyEntity> occs = occupancyRepository.findInWindow(startOfDay, endOfDay);

        List<Map<String, Object>> slots = new ArrayList<>();
        for (OccupancyEntity o : occs) {
            Map<String, Object> s = new LinkedHashMap<>();
            s.put("court_id", o.getCourtId().toString());
            s.put("start", o.getStartAt().toString());
            s.put("end", o.getEndAt().toString());
            s.put("kind", o.getKind());
            s.put("ref_id", o.getRefId().toString());
            slots.add(s);
        }

        Map<String, Object> res = new LinkedHashMap<>();
        res.put("date", date.toString());
        res.put("courts", courts);
        res.put("slots", slots);
        return res;
    }

    @Transactional
    public Map<String, Object> holdBooking(Map<String, Object> body, UserEntity user) {
        String courtIdStr = (String) body.get("court_id");
        String startAtStr = (String) body.get("start_at");
        if (courtIdStr == null || startAtStr == null) {
            throw ApiException.validation("Thiếu court_id hoặc start_at.");
        }

        UUID courtId = UUID.fromString(courtIdStr);
        OffsetDateTime startAt = OffsetDateTime.parse(startAtStr);
        OffsetDateTime endAt = startAt.plusHours(1);

        CourtEntity court = courtRepository.findById(courtId)
                .orElseThrow(() -> ApiException.notFound("Không tìm thấy sân."));
        if (!"ready".equalsIgnoreCase(court.getStatus())) {
            throw ApiException.br("BR-12", "Sân đang bảo trì.");
        }

        // Release any existing hold of this user
        if (user != null) {
            List<CourtBookingEntity> oldHolds = courtBookingRepository.findByUserIdAndStatus(user.getId(), "hold");
            for (CourtBookingEntity h : oldHolds) {
                if (h.getOccupancyId() != null) {
                    occupancyRepository.deleteById(h.getOccupancyId());
                    h.setOccupancyId(null);
                }
                h.setStatus("cancelled");
                courtBookingRepository.save(h);
            }
        }

        // Check occupancy conflict
        List<OccupancyEntity> overlaps = occupancyRepository.findOverlapping(courtId, startAt, endAt);
        if (!overlaps.isEmpty()) {
            throw ApiException.conflictSlot("Khung giờ đã có người đặt hoặc trùng lịch.");
        }

        // Calculate price & discount
        PricingService.PriceResult priceRes = pricingService.lookupPrice(court.getSport(), courtId, startAt);
        PricingService.DiscountResult discRes = user != null
                ? pricingService.memberDiscount(user.getId(), court.getSport())
                : new PricingService.DiscountResult();

        int finalPrice = pricingService.applyDiscount(priceRes.getPriceVnd(), discRes.getPct(), 1000);

        UUID bookingId = UUID.randomUUID();
        UUID occId = UUID.randomUUID();

        // Create occupancy
        OccupancyEntity occ = new OccupancyEntity();
        occ.setId(occId);
        occ.setCourtId(courtId);
        occ.setStartAt(startAt);
        occ.setEndAt(endAt);
        occ.setKind("hold");
        occ.setRefId(bookingId);
        occupancyRepository.save(occ);

        // Create booking
        CourtBookingEntity booking = new CourtBookingEntity();
        booking.setId(bookingId);
        booking.setCode("BK-" + System.currentTimeMillis() % 1000000);
        booking.setCourtId(courtId);
        if (user != null) {
            booking.setUserId(user.getId());
        } else {
            booking.setGuestName((String) body.get("guest_name"));
            booking.setGuestPhone((String) body.get("guest_phone"));
        }
        booking.setStartAt(startAt);
        booking.setEndAt(endAt);
        booking.setStatus("hold");
        booking.setPriceVnd(finalPrice);
        booking.setDiscountPct(discRes.getPct());
        booking.setHoldUntil(OffsetDateTime.now().plusMinutes(5));
        booking.setOccupancyId(occId);
        courtBookingRepository.save(booking);

        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("booking", booking);
        resp.put("price", finalPrice);
        resp.put("is_peak", priceRes.isPeak());
        resp.put("discount_pct", discRes.getPct());
        resp.put("court_hours_applied", 0);
        return resp;
    }

    @Transactional
    public Map<String, Object> cancelBooking(UUID bookingId, UserEntity user) {
        CourtBookingEntity b = courtBookingRepository.findById(bookingId)
                .orElseThrow(() -> ApiException.notFound("Không tìm thấy booking."));

        if (b.getOccupancyId() != null) {
            occupancyRepository.deleteById(b.getOccupancyId());
            b.setOccupancyId(null);
        }
        b.setStatus("cancelled");
        courtBookingRepository.save(b);

        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("success", true);
        resp.put("booking", b);
        return resp;
    }
}
""")

print("Done writing core services!")
