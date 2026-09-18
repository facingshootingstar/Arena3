package com.arena3.service;

import com.arena3.entity.MembershipPlanEntity;
import com.arena3.entity.PriceRuleEntity;
import com.arena3.entity.SubscriptionEntity;
import com.arena3.repository.MembershipPlanRepository;
import com.arena3.repository.PriceRuleRepository;
import com.arena3.repository.SubscriptionRepository;
import org.mockito.Mockito;
import org.testng.Assert;
import org.testng.annotations.BeforeMethod;
import org.testng.annotations.DataProvider;
import org.testng.annotations.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;

/**
 * Module 1 Test: PricingService
 * Kiểm thử tính giá sân theo khung giờ cao điểm/thấp điểm, ngày thường/cuối tuần
 * và chiết khấu theo gói hội viên đang kích hoạt.
 */
public class PricingServiceTest {

    private PriceRuleRepository priceRuleRepository;
    private SubscriptionRepository subscriptionRepository;
    private MembershipPlanRepository membershipPlanRepository;
    private PricingService pricingService;

    @BeforeMethod
    public void setUp() {
        priceRuleRepository = Mockito.mock(PriceRuleRepository.class);
        subscriptionRepository = Mockito.mock(SubscriptionRepository.class);
        membershipPlanRepository = Mockito.mock(MembershipPlanRepository.class);

        pricingService = new PricingService(priceRuleRepository, subscriptionRepository, membershipPlanRepository);
    }

    @DataProvider(name = "timePriceProvider")
    public Object[][] timePriceProvider() {
        return new Object[][]{
                // Ngày thường: 09:00 sáng -> Thấp điểm (80.000đ)
                {"2026-09-16T09:00:00+07:00", "weekday", 540, 80000, false},
                // Ngày thường: 18:00 tối -> Cao điểm (140.000đ)
                {"2026-09-16T18:00:00+07:00", "weekday", 1080, 140000, true},
                // Cuối tuần: 07:00 sáng -> Thấp điểm (80.000đ)
                {"2026-09-20T07:00:00+07:00", "weekend", 420, 80000, false},
                // Cuối tuần: 10:00 sáng -> Cao điểm (140.000đ - cuối tuần cao điểm từ 08:00)
                {"2026-09-20T10:00:00+07:00", "weekend", 600, 140000, true}
        };
    }

    @Test(dataProvider = "timePriceProvider", description = "Kiểm tra tính giá sân theo giờ cao điểm và ngày thường/cuối tuần")
    public void testLookupPriceDynamic(String isoTime, String expectedDayKind, int minutes, int expectedPrice, boolean expectedPeak) {
        OffsetDateTime time = OffsetDateTime.parse(isoTime);
        UUID courtId = UUID.randomUUID();

        PriceRuleEntity rule = new PriceRuleEntity();
        rule.setSport("badminton");
        rule.setDayKind(expectedDayKind);
        rule.setPriceVnd(expectedPrice);
        rule.setPeak(expectedPeak);
        rule.setStartMin(0);
        rule.setEndMin(1440);

        when(priceRuleRepository.findMatchingRules(eq("badminton"), eq(expectedDayKind), anyInt()))
                .thenReturn(List.of(rule));

        PricingService.PriceResult result = pricingService.lookupPrice("badminton", courtId, time);

        Assert.assertNotNull(result, "Kết quả tính giá không được null");
        Assert.assertEquals(result.getPriceVnd(), expectedPrice, "Giá thuê sân không khớp");
        Assert.assertEquals(result.isPeak(), expectedPeak, "Trạng thái giờ cao điểm không khớp");
    }

    @Test(description = "Ưu tiên luật giá riêng của từng sân so với luật giá chung của môn thể thao")
    public void testCourtSpecificPriceRulePriority() {
        UUID courtVipId = UUID.randomUUID();
        OffsetDateTime time = OffsetDateTime.parse("2026-09-16T18:00:00+07:00");

        // Luật chung toàn môn cầu lông
        PriceRuleEntity generalRule = new PriceRuleEntity();
        generalRule.setSport("badminton");
        generalRule.setCourtId(null);
        generalRule.setPriceVnd(140000);
        generalRule.setPeak(true);

        // Luật riêng cho sân VIP (giá cao hơn)
        PriceRuleEntity vipRule = new PriceRuleEntity();
        vipRule.setSport("badminton");
        vipRule.setCourtId(courtVipId);
        vipRule.setPriceVnd(200000);
        vipRule.setPeak(true);

        when(priceRuleRepository.findMatchingRules(eq("badminton"), anyString(), anyInt()))
                .thenReturn(Arrays.asList(generalRule, vipRule));

        PricingService.PriceResult result = pricingService.lookupPrice("badminton", courtVipId, time);

        Assert.assertEquals(result.getPriceVnd(), 200000, "Phải ưu tiên bảng giá riêng của sân VIP");
    }

    @Test(description = "Kiểm tra chiết khấu hội viên có gói tập hoạt động")
    public void testMemberDiscountActiveSubscription() {
        UUID userId = UUID.randomUUID();
        UUID planId = UUID.randomUUID();

        SubscriptionEntity sub = new SubscriptionEntity();
        sub.setId(UUID.randomUUID());
        sub.setUserId(userId);
        sub.setPlanId(planId);
        sub.setSportScope("badminton");
        sub.setStatus("active");
        sub.setCourtHoursLeft(BigDecimal.valueOf(10));
        sub.setStartOn(LocalDate.now().minusDays(5));
        sub.setEndOn(LocalDate.now().plusDays(25)); // Còn hạn

        MembershipPlanEntity plan = new MembershipPlanEntity();
        plan.setId(planId);
        plan.setCourtDiscountPct(20); // Giảm 20%

        when(subscriptionRepository.findByUserIdAndStatus(userId, "active")).thenReturn(List.of(sub));
        when(membershipPlanRepository.findById(planId)).thenReturn(Optional.of(plan));

        PricingService.DiscountResult discount = pricingService.memberDiscount(userId, "badminton");

        Assert.assertNotNull(discount);
        Assert.assertEquals(discount.getPct(), 20, "Phần trăm giảm giá phải là 20%");
        Assert.assertEquals(discount.getCourtHoursLeft(), BigDecimal.valueOf(10));
    }

    @Test(description = "Gói tập môn khác không được áp dụng giảm giá")
    public void testMemberDiscountDifferentSport() {
        UUID userId = UUID.randomUUID();
        UUID planId = UUID.randomUUID();

        SubscriptionEntity sub = new SubscriptionEntity();
        sub.setId(UUID.randomUUID());
        sub.setUserId(userId);
        sub.setPlanId(planId);
        sub.setSportScope("basketball"); // Chỉ bóng rổ
        sub.setStatus("active");
        sub.setStartOn(LocalDate.now().minusDays(5));
        sub.setEndOn(LocalDate.now().plusDays(25));

        when(subscriptionRepository.findByUserIdAndStatus(userId, "active")).thenReturn(List.of(sub));

        PricingService.DiscountResult discount = pricingService.memberDiscount(userId, "badminton");

        Assert.assertEquals(discount.getPct(), 0, "Gói bóng rổ không được giảm giá cho sân cầu lông");
    }

    @Test(description = "Kiểm tra công thức áp dụng chiết khấu và làm tròn 1.000đ")
    public void testApplyDiscountRounding() {
        int listPrice = 140000;
        int discountPct = 15; // Giảm 15% -> 140000 * 0.85 = 119000

        int netPrice = pricingService.applyDiscount(listPrice, discountPct, 1000);
        Assert.assertEquals(netPrice, 119000, "Giá sau chiết khấu làm tròn đúng");

        // Trường hợp không giảm giá
        Assert.assertEquals(pricingService.applyDiscount(listPrice, 0, 1000), 140000);
    }
}
