package com.arena3.config;

import com.arena3.entity.*;
import com.arena3.repository.*;
import com.arena3.security.ScryptPasswordEncoder;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.UUID;

@Component
public class DataInitializer implements CommandLineRunner {

    private final UserRepository userRepository;
    private final CenterSettingsRepository centerSettingsRepository;
    private final CourtRepository courtRepository;
    private final PriceRuleRepository priceRuleRepository;
    private final MembershipPlanRepository membershipPlanRepository;
    private final SubscriptionRepository subscriptionRepository;
    private final ClassRepository classRepository;
    private final SessionRepository sessionRepository;
    private final EnrollmentRepository enrollmentRepository;
    private final FeatureFlagRepository featureFlagRepository;
    private final EquipmentItemRepository equipmentItemRepository;
    private final ScryptPasswordEncoder passwordEncoder;

    public DataInitializer(UserRepository userRepository,
                           CenterSettingsRepository centerSettingsRepository,
                           CourtRepository courtRepository,
                           PriceRuleRepository priceRuleRepository,
                           MembershipPlanRepository membershipPlanRepository,
                           SubscriptionRepository subscriptionRepository,
                           ClassRepository classRepository,
                           SessionRepository sessionRepository,
                           EnrollmentRepository enrollmentRepository,
                           FeatureFlagRepository featureFlagRepository,
                           EquipmentItemRepository equipmentItemRepository,
                           ScryptPasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.centerSettingsRepository = centerSettingsRepository;
        this.courtRepository = courtRepository;
        this.priceRuleRepository = priceRuleRepository;
        this.membershipPlanRepository = membershipPlanRepository;
        this.subscriptionRepository = subscriptionRepository;
        this.classRepository = classRepository;
        this.sessionRepository = sessionRepository;
        this.enrollmentRepository = enrollmentRepository;
        this.featureFlagRepository = featureFlagRepository;
        this.equipmentItemRepository = equipmentItemRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    public void run(String... args) throws Exception {
        if (userRepository.count() > 0) {
            return;
        }

        // 1. Settings
        CenterSettingsEntity settings = new CenterSettingsEntity();
        settings.setAddress("Số 12 Đường Hoàng Quốc Việt, Phường Phú Mỹ, Quận 7, TP. Hồ Chí Minh");
        settings.setCloseTime("23:00");
        centerSettingsRepository.save(settings);

        // 2. Feature Flags
        featureFlagRepository.save(new FeatureFlagEntity("F4", true));
        featureFlagRepository.save(new FeatureFlagEntity("F5", true));
        featureFlagRepository.save(new FeatureFlagEntity("F6", true));
        featureFlagRepository.save(new FeatureFlagEntity("SMS", false));

        // 3. Demo Users
        String seedPassHash = "scrypt$16384$8$1$YXJlbmEzLXNlZWQtc2FsdDAx$axaSnV-o4ii8w0VPbDo0H8xnqyciiffPfWSOqPngAxA";

        // Manager
        UserEntity manager = new UserEntity();
        manager.setId(UUID.fromString("00000000-0000-0000-0000-000000000001"));
        manager.setFullName("Quản lý Arena3");
        manager.setNameNormalized("quan ly arena3");
        manager.setPhone("+84900000001");
        manager.setEmail("manager@arena3.local");
        manager.setRole("manager");
        manager.setStatus("active");
        manager.setPasswordHash(seedPassHash);
        manager = userRepository.save(manager);

        // Desk
        UserEntity desk = new UserEntity();
        desk.setId(UUID.fromString("00000000-0000-0000-0000-000000000002"));
        desk.setFullName("Lễ tân ca 1");
        desk.setNameNormalized("le tan ca 1");
        desk.setPhone("+84900000002");
        desk.setEmail("letan@arena3.local");
        desk.setRole("receptionist");
        desk.setStatus("active");
        desk.setPasswordHash(seedPassHash);
        desk = userRepository.save(desk);

        // Coach
        UserEntity coach = new UserEntity();
        coach.setId(UUID.fromString("00000000-0000-0000-0000-000000000011"));
        coach.setFullName("Nguyễn Minh Khoa");
        coach.setNameNormalized("nguyen minh khoa");
        coach.setPhone("+84901110011");
        coach.setEmail("khoa.hlv@arena3.local");
        coach.setRole("coach");
        coach.setStatus("active");
        coach.setPasswordHash(seedPassHash);
        coach = userRepository.save(coach);

        // Coach Lan (badminton)
        UserEntity coachLan = new UserEntity();
        coachLan.setId(UUID.fromString("00000000-0000-0000-0000-000000000012"));
        coachLan.setFullName("Trần Thị Lan");
        coachLan.setNameNormalized("tran thi lan");
        coachLan.setPhone("+84901110012");
        coachLan.setEmail("lan.hlv@arena3.local");
        coachLan.setRole("coach");
        coachLan.setStatus("active");
        coachLan.setPasswordHash(seedPassHash);
        coachLan = userRepository.save(coachLan);

        // Coach Anh (basketball)
        UserEntity coachAnh = new UserEntity();
        coachAnh.setId(UUID.fromString("00000000-0000-0000-0000-000000000013"));
        coachAnh.setFullName("Phạm Đức Anh");
        coachAnh.setNameNormalized("pham duc anh");
        coachAnh.setPhone("+84901110013");
        coachAnh.setEmail("anh.hlv@arena3.local");
        coachAnh.setRole("coach");
        coachAnh.setStatus("active");
        coachAnh.setPasswordHash(seedPassHash);
        coachAnh = userRepository.save(coachAnh);

        // Coach Viet (volleyball)
        UserEntity coachViet = new UserEntity();
        coachViet.setId(UUID.fromString("00000000-0000-0000-0000-000000000014"));
        coachViet.setFullName("Lê Quốc Việt");
        coachViet.setNameNormalized("le quoc viet");
        coachViet.setPhone("+84901110014");
        coachViet.setEmail("viet.hlv@arena3.local");
        coachViet.setRole("coach");
        coachViet.setStatus("active");
        coachViet.setPasswordHash(seedPassHash);
        coachViet = userRepository.save(coachViet);

        // Member Nam
        UserEntity nam = new UserEntity();
        nam.setId(UUID.fromString("00000000-0000-0000-0000-000000000101"));
        nam.setMemberCode("A3-2026-0001");
        nam.setFullName("Nguyễn Văn Nam");
        nam.setNameNormalized("nguyen van nam");
        nam.setPhone("+84901230101");
        nam.setEmail("nam.nguyen@example.com");
        nam.setRole("member");
        nam.setStatus("active");
        nam.setPasswordHash(seedPassHash);
        nam.setDateOfBirth(LocalDate.of(1998, 4, 15));
        nam.setHealthNotes("Mục tiêu: giảm cân, trình độ cầu lông mới");
        nam = userRepository.save(nam);

        // 4. Courts
        UUID cl1Id = UUID.fromString("10000000-0000-0000-0000-000000000001");
        CourtEntity cl1 = new CourtEntity();
        cl1.setId(cl1Id);
        cl1.setCourtCode("CL-01");
        cl1.setSport("badminton");
        cl1 = courtRepository.save(cl1);

        for (int i = 2; i <= 8; i++) {
            CourtEntity c = new CourtEntity();
            c.setId(UUID.fromString(String.format("10000000-0000-0000-0000-00000000000%d", i)));
            c.setCourtCode("CL-0" + i);
            c.setSport("badminton");
            courtRepository.save(c);
        }

        CourtEntity br1 = new CourtEntity();
        br1.setId(UUID.fromString("10000000-0000-0000-0000-000000000010"));
        br1.setCourtCode("BR-01");
        br1.setSport("basketball");
        br1.setConvertible(true);
        courtRepository.save(br1);

        CourtEntity bc1 = new CourtEntity();
        bc1.setId(UUID.fromString("10000000-0000-0000-0000-000000000011"));
        bc1.setCourtCode("BC-01");
        bc1.setSport("volleyball");
        bc1.setConvertible(true);
        courtRepository.save(bc1);

        // 5. Price Rules
        createPriceRule("badminton", "weekday", "06:00", "17:00", 80000, false);
        createPriceRule("badminton", "weekday", "17:00", "22:00", 140000, true);
        createPriceRule("badminton", "weekend", "06:00", "08:00", 80000, false);
        createPriceRule("badminton", "weekend", "08:00", "22:00", 140000, true);

        createPriceRule("basketball", "weekday", "06:00", "17:00", 300000, false);
        createPriceRule("basketball", "weekday", "17:00", "22:00", 500000, true);
        createPriceRule("basketball", "weekend", "06:00", "08:00", 300000, false);
        createPriceRule("basketball", "weekend", "08:00", "22:00", 500000, true);

        createPriceRule("volleyball", "weekday", "06:00", "17:00", 250000, false);
        createPriceRule("volleyball", "weekday", "17:00", "22:00", 400000, true);
        createPriceRule("volleyball", "weekend", "06:00", "08:00", 250000, false);
        createPriceRule("volleyball", "weekend", "08:00", "22:00", 400000, true);

        // 6. Plans
        MembershipPlanEntity p1 = new MembershipPlanEntity();
        p1.setId(UUID.fromString("20000000-0000-0000-0000-000000000001"));
        p1.setName("All-Access 30 ngày");
        p1.setSportScope("all");
        p1.setDurationDays(30);
        p1.setCourtHours(4);
        p1.setCourtDiscountPct(15);
        p1.setPriceVnd(1450000);
        p1 = membershipPlanRepository.save(p1);

        MembershipPlanEntity p2 = new MembershipPlanEntity();
        p2.setId(UUID.fromString("20000000-0000-0000-0000-000000000002"));
        p2.setName("Cầu lông 30 ngày");
        p2.setSportScope("badminton");
        p2.setDurationDays(30);
        p2.setCourtHours(2);
        p2.setCourtDiscountPct(20);
        p2.setPriceVnd(800000);
        p2 = membershipPlanRepository.save(p2);

        MembershipPlanEntity p3 = new MembershipPlanEntity();
        p3.setId(UUID.fromString("20000000-0000-0000-0000-000000000003"));
        p3.setName("Flexi Pass 10 buổi");
        p3.setSportScope("all");
        p3.setSessionQuota(10);
        p3.setCourtHours(1);
        p3.setCourtDiscountPct(10);
        p3.setPriceVnd(1200000);
        membershipPlanRepository.save(p3);

        MembershipPlanEntity p4 = new MembershipPlanEntity();
        p4.setId(UUID.fromString("20000000-0000-0000-0000-000000000004"));
        p4.setName("Bóng rổ 30 ngày");
        p4.setSportScope("basketball");
        p4.setDurationDays(30);
        p4.setCourtHours(3);
        p4.setCourtDiscountPct(15);
        p4.setPriceVnd(1500000);
        membershipPlanRepository.save(p4);

        MembershipPlanEntity p5 = new MembershipPlanEntity();
        p5.setId(UUID.fromString("20000000-0000-0000-0000-000000000005"));
        p5.setName("VIP Thường niên");
        p5.setSportScope("all");
        p5.setDurationDays(365);
        p5.setCourtHours(8);
        p5.setCourtDiscountPct(30);
        p5.setPriceVnd(12500000);
        p5.setCarryOverHours(true);
        membershipPlanRepository.save(p5);

        // Subscription for Nam
        SubscriptionEntity subNam = new SubscriptionEntity();
        subNam.setId(UUID.fromString("30000000-0000-0000-0000-000000000001"));
        subNam.setUserId(nam.getId());
        subNam.setPlanId(p2.getId());
        subNam.setSportScope("badminton");
        subNam.setStartOn(LocalDate.now().minusDays(5));
        subNam.setEndOn(LocalDate.now().plusDays(25));
        subNam.setStatus("active");
        subNam.setCourtHoursLeft(BigDecimal.valueOf(2.0));
        subscriptionRepository.save(subNam);

        // 7. Classes & Sessions
        // Class 1: Badminton Intermediate (existing, coach Khoa)
        ClassEntity cl = new ClassEntity();
        cl.setId(UUID.fromString("60000000-0000-0000-0000-000000000001"));
        cl.setSport("badminton");
        cl.setLevel("intermediate");
        cl.setCoachId(coach.getId());
        cl.setCourtId(cl1Id);
        cl.setCapacity(12);
        cl.setEnrolledCount(1);
        cl.setRrule("FREQ=WEEKLY;BYDAY=TU,TH");
        cl.setDurationMin(90);
        cl.setStartOn(LocalDate.now().minusDays(7));
        cl.setEndOn(LocalDate.now().plusDays(30));
        cl.setStatus("open");
        cl = classRepository.save(cl);

        SessionEntity session = new SessionEntity();
        session.setClassId(cl.getId());
        session.setCourtId(cl1.getId());
        session.setStartAt(OffsetDateTime.now(ZoneId.of("Asia/Ho_Chi_Minh")).plusDays(1).withHour(18).withMinute(0));
        session.setEndAt(session.getStartAt().plusMinutes(90));
        session.setStatus("scheduled");
        sessionRepository.save(session);

        EnrollmentEntity enrol = new EnrollmentEntity();
        enrol.setClassId(cl.getId());
        enrol.setUserId(nam.getId());
        enrol.setStatus("confirmed");
        enrollmentRepository.save(enrol);

        // Class 2: Badminton Beginner (coach Lan)
        UUID cl2Id = UUID.fromString("10000000-0000-0000-0000-000000000002");
        ClassEntity cl2 = new ClassEntity();
        cl2.setId(UUID.fromString("60000000-0000-0000-0000-000000000002"));
        cl2.setSport("badminton");
        cl2.setLevel("beginner");
        cl2.setCoachId(coachLan.getId());
        cl2.setCourtId(cl2Id);
        cl2.setCapacity(16);
        cl2.setEnrolledCount(8);
        cl2.setRrule("FREQ=WEEKLY;BYDAY=MO,WE,FR");
        cl2.setDurationMin(75);
        cl2.setStartOn(LocalDate.now().minusDays(14));
        cl2.setEndOn(LocalDate.now().plusDays(45));
        cl2.setStatus("open");
        classRepository.save(cl2);

        // Class 3: Badminton Advanced (coach Khoa)
        UUID cl5Id = UUID.fromString("10000000-0000-0000-0000-000000000005");
        ClassEntity cl3 = new ClassEntity();
        cl3.setId(UUID.fromString("60000000-0000-0000-0000-000000000003"));
        cl3.setSport("badminton");
        cl3.setLevel("advanced");
        cl3.setCoachId(coach.getId());
        cl3.setCourtId(cl5Id);
        cl3.setCapacity(8);
        cl3.setEnrolledCount(5);
        cl3.setRrule("FREQ=WEEKLY;BYDAY=SA");
        cl3.setDurationMin(120);
        cl3.setStartOn(LocalDate.now().minusDays(3));
        cl3.setEndOn(LocalDate.now().plusDays(60));
        cl3.setStatus("open");
        classRepository.save(cl3);

        // Class 4: Basketball Beginner (coach Anh)
        UUID brId = UUID.fromString("10000000-0000-0000-0000-000000000010");
        ClassEntity cl4 = new ClassEntity();
        cl4.setId(UUID.fromString("60000000-0000-0000-0000-000000000004"));
        cl4.setSport("basketball");
        cl4.setLevel("beginner");
        cl4.setCoachId(coachAnh.getId());
        cl4.setCourtId(brId);
        cl4.setCapacity(14);
        cl4.setEnrolledCount(6);
        cl4.setRrule("FREQ=WEEKLY;BYDAY=MO,WE");
        cl4.setDurationMin(90);
        cl4.setStartOn(LocalDate.now().minusDays(10));
        cl4.setEndOn(LocalDate.now().plusDays(50));
        cl4.setStatus("open");
        classRepository.save(cl4);

        // Class 5: Volleyball Intermediate (coach Viet)
        UUID bcId = UUID.fromString("10000000-0000-0000-0000-000000000011");
        ClassEntity cl5class = new ClassEntity();
        cl5class.setId(UUID.fromString("60000000-0000-0000-0000-000000000005"));
        cl5class.setSport("volleyball");
        cl5class.setLevel("intermediate");
        cl5class.setCoachId(coachViet.getId());
        cl5class.setCourtId(bcId);
        cl5class.setCapacity(12);
        cl5class.setEnrolledCount(7);
        cl5class.setRrule("FREQ=WEEKLY;BYDAY=SA");
        cl5class.setDurationMin(90);
        cl5class.setStartOn(LocalDate.now().minusDays(5));
        cl5class.setEndOn(LocalDate.now().plusDays(55));
        cl5class.setStatus("open");
        classRepository.save(cl5class);

        // Class 6: Volleyball Beginner (coach Viet)
        ClassEntity cl6 = new ClassEntity();
        cl6.setId(UUID.fromString("60000000-0000-0000-0000-000000000006"));
        cl6.setSport("volleyball");
        cl6.setLevel("beginner");
        cl6.setCoachId(coachViet.getId());
        cl6.setCourtId(bcId);
        cl6.setCapacity(16);
        cl6.setEnrolledCount(3);
        cl6.setRrule("FREQ=WEEKLY;BYDAY=TU,TH");
        cl6.setDurationMin(75);
        cl6.setStartOn(LocalDate.now().minusDays(2));
        cl6.setEndOn(LocalDate.now().plusDays(42));
        cl6.setStatus("open");
        classRepository.save(cl6);

        // 8. Equipment
        EquipmentItemEntity eq1 = new EquipmentItemEntity();
        eq1.setId(UUID.fromString("40000000-0000-0000-0000-000000000001"));
        eq1.setSku("CL-RKT");
        eq1.setName("Vợt cầu lông Yonex Nanoflare");
        eq1.setSport("badminton");
        eq1.setStock(24);
        eq1.setRentVnd(30000);
        equipmentItemRepository.save(eq1);

        EquipmentItemEntity eq2 = new EquipmentItemEntity();
        eq2.setId(UUID.fromString("40000000-0000-0000-0000-000000000002"));
        eq2.setSku("BR-BALL");
        eq2.setName("Bóng rổ Molten BG4500");
        eq2.setSport("basketball");
        eq2.setStock(12);
        eq2.setRentVnd(40000);
        equipmentItemRepository.save(eq2);

        EquipmentItemEntity eq3 = new EquipmentItemEntity();
        eq3.setId(UUID.fromString("40000000-0000-0000-0000-000000000003"));
        eq3.setSku("BC-BALL");
        eq3.setName("Bóng chuyền Mikasa V200W");
        eq3.setSport("volleyball");
        eq3.setStock(10);
        eq3.setRentVnd(40000);
        equipmentItemRepository.save(eq3);

        EquipmentItemEntity eq4 = new EquipmentItemEntity();
        eq4.setId(UUID.fromString("40000000-0000-0000-0000-000000000004"));
        eq4.setSku("SHOE-NM");
        eq4.setName("Giày đế Non-marking");
        eq4.setSport("all");
        eq4.setStock(20);
        eq4.setRentVnd(50000);
        equipmentItemRepository.save(eq4);

        EquipmentItemEntity eq5 = new EquipmentItemEntity();
        eq5.setId(UUID.fromString("40000000-0000-0000-0000-000000000005"));
        eq5.setSku("CL-STL");
        eq5.setName("Ống cầu Victor Master No.3");
        eq5.setSport("badminton");
        eq5.setStock(30);
        eq5.setRentVnd(25000);
        equipmentItemRepository.save(eq5);
    }

    private void createPriceRule(String sport, String dayKind, String start, String end, int price, boolean isPeak) {
        PriceRuleEntity r = new PriceRuleEntity();
        r.setSport(sport);
        r.setDayKind(dayKind);
        r.setStartLocal(start);
        r.setEndLocal(end);
        r.setPriceVnd(price);
        r.setPeak(isPeak);
        r.computeMinutes();
        priceRuleRepository.save(r);
    }
}
