package com.arena3.service;

import com.arena3.entity.UserEntity;
import com.arena3.exception.ApiException;
import com.arena3.repository.UserRepository;
import com.arena3.security.SecurityUtils;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.*;

@Service
public class MemberService {

    private final UserRepository userRepository;
    private final com.arena3.repository.SubscriptionRepository subscriptionRepository;
    private final com.arena3.repository.MembershipPlanRepository membershipPlanRepository;
    private final com.arena3.repository.CourtBookingRepository courtBookingRepository;
    private final com.arena3.repository.CourtRepository courtRepository;
    private final com.arena3.security.ScryptPasswordEncoder passwordEncoder;

    public MemberService(UserRepository userRepository,
                         com.arena3.repository.SubscriptionRepository subscriptionRepository,
                         com.arena3.repository.MembershipPlanRepository membershipPlanRepository,
                         com.arena3.repository.CourtBookingRepository courtBookingRepository,
                         com.arena3.repository.CourtRepository courtRepository,
                         com.arena3.security.ScryptPasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.subscriptionRepository = subscriptionRepository;
        this.membershipPlanRepository = membershipPlanRepository;
        this.courtBookingRepository = courtBookingRepository;
        this.courtRepository = courtRepository;
        this.passwordEncoder = passwordEncoder;
    }

    public List<Map<String, Object>> searchMembers(String q) {
        String cleanQ = q != null ? q.trim() : "";
        List<UserEntity> users = userRepository.searchUsers(cleanQ);
        if (users.isEmpty() && cleanQ.startsWith("0")) {
            users = userRepository.searchUsers(cleanQ.substring(1));
        }
        List<Map<String, Object>> res = new ArrayList<>();
        for (UserEntity u : users) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", u.getId().toString());
            m.put("member_code", u.getMemberCode());
            m.put("full_name", u.getFullName());
            m.put("phone", u.getPhone());
            m.put("email", u.getEmail());
            m.put("role", u.getRole());
            m.put("status", u.getStatus());
            m.put("date_of_birth", u.getDateOfBirth() != null ? u.getDateOfBirth().toString() : null);
            m.put("created_at", u.getCreatedAt().toString());
            res.add(m);
        }
        return res;
    }

    @Transactional
    public Map<String, Object> createMember(Map<String, Object> body, UserEntity receptionist) {
        String phone = SecurityUtils.normalizePhone((String) body.get("phone"));
        Optional<UserEntity> existing = userRepository.findByLogin(phone);
        if (existing.isPresent()) {
            Map<String, Object> res = new LinkedHashMap<>();
            res.put("user", toUserMap(existing.get()));
            res.put("existing", true);
            return res;
        }

        String fullName = (String) body.get("full_name");
        String tmpPassword = "A3tmp" + (1000 + new Random().nextInt(9000)) + "a";
        String memberCode = "A3-2026-" + String.format("%04d", userRepository.count() + 1);

        UserEntity u = new UserEntity();
        u.setFullName(fullName);
        u.setNameNormalized(SecurityUtils.unaccentVi(fullName));
        u.setPhone(phone);
        u.setRole("member");
        u.setStatus("active");
        u.setMemberCode(memberCode);
        u.setPasswordHash(passwordEncoder.encode(tmpPassword));
        u.setMustChangePassword(true);
        u.setCreatedAt(OffsetDateTime.now());
        u = userRepository.save(u);

        Map<String, Object> res = new LinkedHashMap<>();
        res.put("user", toUserMap(u));
        res.put("temp_password", tmpPassword);
        return res;
    }

    public Map<String, Object> getMember(UUID id) {
        UserEntity u = userRepository.findById(id)
                .orElseThrow(() -> ApiException.notFound("Không tìm thấy hội viên."));

        Map<String, Object> res = new LinkedHashMap<>();
        res.put("user", toUserMap(u));
        res.put("debt_vnd", 0);

        List<com.arena3.entity.SubscriptionEntity> subs = subscriptionRepository.findByUserId(id);
        List<Map<String, Object>> subList = new ArrayList<>();
        for (com.arena3.entity.SubscriptionEntity s : subs) {
            Map<String, Object> sm = new LinkedHashMap<>();
            sm.put("id", s.getId().toString());
            sm.put("status", s.getStatus());
            sm.put("sport_scope", s.getSportScope());
            sm.put("end_on", s.getEndOn() != null ? s.getEndOn().toString() : null);
            sm.put("court_hours_left", s.getCourtHoursLeft());
            sm.put("frozen_days", s.getFrozenDays());
            membershipPlanRepository.findById(s.getPlanId()).ifPresent(p -> sm.put("plan_name", p.getName()));
            subList.add(sm);
        }
        res.put("subscriptions", subList);

        List<com.arena3.entity.CourtBookingEntity> bookings = courtBookingRepository.findByUserIdAndStatus(id, "confirmed");
        List<Map<String, Object>> bList = new ArrayList<>();
        for (com.arena3.entity.CourtBookingEntity b : bookings) {
            Map<String, Object> bm = new LinkedHashMap<>();
            bm.put("id", b.getId().toString());
            bm.put("code", b.getCode());
            bm.put("start_at", b.getStartAt().toString());
            bm.put("status", b.getStatus());
            courtRepository.findById(b.getCourtId()).ifPresent(c -> bm.put("court_code", c.getCourtCode()));
            bList.add(bm);
        }

        Map<String, Object> today = new LinkedHashMap<>();
        today.put("bookings", bList);
        today.put("classes", Collections.emptyList());
        res.put("today", today);

        return res;
    }

    private Map<String, Object> toUserMap(UserEntity u) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", u.getId().toString());
        m.put("member_code", u.getMemberCode());
        m.put("full_name", u.getFullName());
        m.put("phone", u.getPhone());
        m.put("email", u.getEmail());
        m.put("role", u.getRole());
        m.put("status", u.getStatus());
        return m;
    }
}
