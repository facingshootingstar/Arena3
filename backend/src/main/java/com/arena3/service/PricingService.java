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
