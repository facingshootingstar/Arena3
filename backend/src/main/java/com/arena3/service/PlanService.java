package com.arena3.service;

import com.arena3.entity.MembershipPlanEntity;
import com.arena3.entity.SubscriptionEntity;
import com.arena3.entity.UserEntity;
import com.arena3.exception.ApiException;
import com.arena3.repository.MembershipPlanRepository;
import com.arena3.repository.SubscriptionRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;

@Service
public class PlanService {

    private final MembershipPlanRepository membershipPlanRepository;
    private final SubscriptionRepository subscriptionRepository;

    public PlanService(MembershipPlanRepository membershipPlanRepository,
                       SubscriptionRepository subscriptionRepository) {
        this.membershipPlanRepository = membershipPlanRepository;
        this.subscriptionRepository = subscriptionRepository;
    }

    public List<MembershipPlanEntity> getPlans(UserEntity user) {
        if (user != null && ("manager".equalsIgnoreCase(user.getRole()) || "receptionist".equalsIgnoreCase(user.getRole()))) {
            return membershipPlanRepository.findAll();
        }
        return membershipPlanRepository.findByIsOnSaleTrue();
    }

    @Transactional
    public MembershipPlanEntity createPlan(Map<String, Object> body, UserEntity user) {
        MembershipPlanEntity p = new MembershipPlanEntity();
        p.setName((String) body.get("name"));
        p.setSportScope((String) body.get("sport_scope"));
        if (body.get("duration_days") != null) p.setDurationDays(((Number) body.get("duration_days")).intValue());
        if (body.get("session_quota") != null) p.setSessionQuota(((Number) body.get("session_quota")).intValue());
        if (body.get("court_hours") != null) p.setCourtHours(((Number) body.get("court_hours")).intValue());
        if (body.get("court_discount_pct") != null) p.setCourtDiscountPct(((Number) body.get("court_discount_pct")).intValue());
        p.setPriceVnd(((Number) body.get("price_vnd")).intValue());
        p.setOnSale(Boolean.TRUE.equals(body.getOrDefault("is_on_sale", true)));
        return membershipPlanRepository.save(p);
    }

    @Transactional
    public MembershipPlanEntity patchPlan(UUID id, Map<String, Object> body, UserEntity user) {
        MembershipPlanEntity p = membershipPlanRepository.findById(id)
                .orElseThrow(() -> ApiException.notFound("Không tìm thấy gói."));
        if (body.containsKey("name")) p.setName((String) body.get("name"));
        if (body.containsKey("sport_scope")) p.setSportScope((String) body.get("sport_scope"));
        if (body.containsKey("duration_days") && body.get("duration_days") != null) p.setDurationDays(((Number) body.get("duration_days")).intValue());
        if (body.containsKey("session_quota")) p.setSessionQuota(body.get("session_quota") != null ? ((Number) body.get("session_quota")).intValue() : null);
        if (body.containsKey("court_hours") && body.get("court_hours") != null) p.setCourtHours(((Number) body.get("court_hours")).intValue());
        if (body.containsKey("court_discount_pct") && body.get("court_discount_pct") != null) p.setCourtDiscountPct(((Number) body.get("court_discount_pct")).intValue());
        if (body.containsKey("price_vnd") && body.get("price_vnd") != null) p.setPriceVnd(((Number) body.get("price_vnd")).intValue());
        if (body.containsKey("is_on_sale")) p.setOnSale(Boolean.TRUE.equals(body.get("is_on_sale")));
        if (body.containsKey("carry_over_hours")) p.setCarryOverHours(Boolean.TRUE.equals(body.get("carry_over_hours")));
        return membershipPlanRepository.save(p);
    }

    @Transactional
    public SubscriptionEntity createSubscription(Map<String, Object> body, UserEntity user) {
        UUID planId = UUID.fromString((String) body.get("plan_id"));
        UUID targetUserId = body.get("user_id") != null ? UUID.fromString((String) body.get("user_id")) : user.getId();

        MembershipPlanEntity plan = membershipPlanRepository.findById(planId)
                .orElseThrow(() -> ApiException.notFound("Không tìm thấy gói tập."));

        SubscriptionEntity sub = new SubscriptionEntity();
        sub.setUserId(targetUserId);
        sub.setPlanId(planId);
        sub.setSportScope(plan.getSportScope());
        sub.setStartOn(LocalDate.now());
        sub.setEndOn(LocalDate.now().plusDays(plan.getDurationDays() != null ? plan.getDurationDays() : 30));
        sub.setStatus("active");
        sub.setCourtHoursLeft(BigDecimal.valueOf(plan.getCourtHours()));
        sub.setSessionLeft(plan.getSessionQuota());
        return subscriptionRepository.save(sub);
    }

    @Transactional
    public SubscriptionEntity freezeSubscription(UUID id, int days, UserEntity user) {
        SubscriptionEntity s = subscriptionRepository.findById(id)
                .orElseThrow(() -> ApiException.notFound("Không tìm thấy gói hội viên."));
        s.setStatus("frozen");
        s.setFrozenDays(s.getFrozenDays() + days);
        s.setEndOn(s.getEndOn().plusDays(days));
        return subscriptionRepository.save(s);
    }

    @Transactional
    public SubscriptionEntity unfreezeSubscription(UUID id, UserEntity user) {
        SubscriptionEntity s = subscriptionRepository.findById(id)
                .orElseThrow(() -> ApiException.notFound("Không tìm thấy gói hội viên."));
        s.setStatus("active");
        return subscriptionRepository.save(s);
    }
}
