import os

BASE = os.path.dirname(os.path.abspath(__file__))
JAVA = os.path.join(BASE, "src", "main", "java", "com", "arena3")

def w(path, content):
    p = os.path.join(JAVA, path)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    with open(p, "w", encoding="utf-8") as f:
        f.write(content.strip() + "\n")
    print("Wrote:", path)

w("service/PlanService.java", """
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

    public List<MembershipPlanEntity> getPlans() {
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
}
""")

w("service/ClassService.java", """
package com.arena3.service;

import com.arena3.entity.ClassEntity;
import com.arena3.entity.CourtEntity;
import com.arena3.entity.EnrollmentEntity;
import com.arena3.entity.SessionEntity;
import com.arena3.entity.UserEntity;
import com.arena3.exception.ApiException;
import com.arena3.repository.ClassRepository;
import com.arena3.repository.CourtRepository;
import com.arena3.repository.EnrollmentRepository;
import com.arena3.repository.SessionRepository;
import com.arena3.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

@Service
public class ClassService {

    private final ClassRepository classRepository;
    private final SessionRepository sessionRepository;
    private final EnrollmentRepository enrollmentRepository;
    private final UserRepository userRepository;
    private final CourtRepository courtRepository;

    public ClassService(ClassRepository classRepository,
                        SessionRepository sessionRepository,
                        EnrollmentRepository enrollmentRepository,
                        UserRepository userRepository,
                        CourtRepository courtRepository) {
        this.classRepository = classRepository;
        this.sessionRepository = sessionRepository;
        this.enrollmentRepository = enrollmentRepository;
        this.userRepository = userRepository;
        this.courtRepository = courtRepository;
    }

    public List<Map<String, Object>> getClasses(UserEntity currentUser) {
        List<ClassEntity> list = classRepository.findAll();
        List<Map<String, Object>> result = new ArrayList<>();
        for (ClassEntity c : list) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", c.getId().toString());
            m.put("sport", c.getSport());
            m.put("level", c.getLevel());
            m.put("coach_id", c.getCoachId().toString());
            userRepository.findById(c.getCoachId()).ifPresent(u -> m.put("coach_name", u.getFullName()));
            m.put("court_id", c.getCourtId().toString());
            courtRepository.findById(c.getCourtId()).ifPresent(crt -> m.put("court_code", crt.getCourtCode()));
            m.put("capacity", c.getCapacity());
            m.put("enrolled_count", c.getEnrolledCount());
            m.put("rrule", c.getRrule());
            m.put("duration_min", c.getDurationMin());
            m.put("start_on", c.getStartOn().toString());
            m.put("end_on", c.getEndOn().toString());
            m.put("status", c.getStatus());

            boolean myEnrolled = false;
            if (currentUser != null) {
                myEnrolled = enrollmentRepository.findByClassIdAndUserId(c.getId(), currentUser.getId()).isPresent();
            }
            m.put("my_enrolled", myEnrolled);
            result.add(m);
        }
        return result;
    }

    public List<Map<String, Object>> getCoachSchedule(UserEntity coach) {
        List<ClassEntity> classes = classRepository.findByCoachId(coach.getId());
        List<Map<String, Object>> schedule = new ArrayList<>();
        for (ClassEntity c : classes) {
            List<SessionEntity> sessions = sessionRepository.findByClassId(c.getId());
            for (SessionEntity s : sessions) {
                Map<String, Object> item = new LinkedHashMap<>();
                item.put("id", s.getId().toString());
                item.put("class_id", c.getId().toString());
                item.put("sport", c.getSport());
                item.put("level", c.getLevel());
                courtRepository.findById(s.getCourtId()).ifPresent(crt -> item.put("court_code", crt.getCourtCode()));
                item.put("start_at", s.getStartAt().toString());
                item.put("end_at", s.getEndAt().toString());
                item.put("status", s.getStatus());
                item.put("enrolled_count", c.getEnrolledCount());
                item.put("capacity", c.getCapacity());
                schedule.add(item);
            }
        }
        return schedule;
    }

    @Transactional
    public Map<String, Object> enroll(UUID classId, UserEntity user) {
        ClassEntity c = classRepository.findById(classId)
                .orElseThrow(() -> ApiException.notFound("Không tìm thấy lớp học."));

        if (c.getEnrolledCount() >= c.getCapacity()) {
            throw ApiException.conflict("Lớp đã đầy sĩ số.");
        }

        EnrollmentEntity e = new EnrollmentEntity();
        e.setClassId(classId);
        e.setUserId(user.getId());
        e.setStatus("confirmed");
        enrollmentRepository.save(e);

        c.setEnrolledCount(c.getEnrolledCount() + 1);
        classRepository.save(c);

        Map<String, Object> res = new LinkedHashMap<>();
        res.put("success", true);
        res.put("enrollment_id", e.getId().toString());
        return res;
    }
}
""")

w("service/DeskService.java", """
package com.arena3.service;

import com.arena3.entity.AuditLogEntity;
import com.arena3.entity.CashierShiftEntity;
import com.arena3.entity.CenterSettingsEntity;
import com.arena3.entity.PaymentEntity;
import com.arena3.entity.PriceRuleEntity;
import com.arena3.entity.UserEntity;
import com.arena3.exception.ApiException;
import com.arena3.repository.AuditLogRepository;
import com.arena3.repository.CashierShiftRepository;
import com.arena3.repository.CenterSettingsRepository;
import com.arena3.repository.PaymentRepository;
import com.arena3.repository.PriceRuleRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.*;

@Service
public class DeskService {

    private final CashierShiftRepository cashierShiftRepository;
    private final PriceRuleRepository priceRuleRepository;
    private final PaymentRepository paymentRepository;
    private final CenterSettingsRepository centerSettingsRepository;
    private final AuditLogRepository auditLogRepository;

    public DeskService(CashierShiftRepository cashierShiftRepository,
                       PriceRuleRepository priceRuleRepository,
                       PaymentRepository paymentRepository,
                       CenterSettingsRepository centerSettingsRepository,
                       AuditLogRepository auditLogRepository) {
        this.cashierShiftRepository = cashierShiftRepository;
        this.priceRuleRepository = priceRuleRepository;
        this.paymentRepository = paymentRepository;
        this.centerSettingsRepository = centerSettingsRepository;
        this.auditLogRepository = auditLogRepository;
    }

    public List<PriceRuleEntity> getPriceRules() {
        return priceRuleRepository.findAll();
    }

    @Transactional
    public CashierShiftEntity openShift(UserEntity user) {
        Optional<CashierShiftEntity> current = cashierShiftRepository.findFirstByReceptionistIdAndClosedAtIsNull(user.getId());
        if (current.isPresent()) return current.get();

        CashierShiftEntity shift = new CashierShiftEntity();
        shift.setReceptionistId(user.getId());
        shift.setOpenedAt(OffsetDateTime.now());
        return cashierShiftRepository.save(shift);
    }

    public CashierShiftEntity getCurrentShift(UserEntity user) {
        return cashierShiftRepository.findFirstByReceptionistIdAndClosedAtIsNull(user.getId())
                .or(() -> cashierShiftRepository.findFirstByClosedAtIsNullOrderByOpenedAtDesc())
                .orElse(null);
    }

    public Map<String, Object> getRevenueReport(String from, String to, UserEntity user) {
        if (!"manager".equalsIgnoreCase(user.getRole())) {
            throw ApiException.forbidden("Chỉ quản lý mới có quyền xem báo cáo doanh thu.");
        }

        List<PaymentEntity> payments = paymentRepository.findAll();
        long totalVnd = 0;
        long cash = 0, card = 0, transfer = 0, gateway = 0;

        for (PaymentEntity p : payments) {
            if ("posted".equalsIgnoreCase(p.getStatus())) {
                totalVnd += p.getAmountVnd();
                if ("cash".equalsIgnoreCase(p.getMethod())) cash += p.getAmountVnd();
                else if ("card".equalsIgnoreCase(p.getMethod())) card += p.getAmountVnd();
                else if ("transfer".equalsIgnoreCase(p.getMethod())) transfer += p.getAmountVnd();
                else if ("gateway".equalsIgnoreCase(p.getMethod())) gateway += p.getAmountVnd();
            }
        }

        Map<String, Object> totals = new LinkedHashMap<>();
        totals.put("total_vnd", totalVnd);
        totals.put("count", payments.size());
        totals.put("cash_vnd", cash);
        totals.put("card_vnd", card);
        totals.put("transfer_vnd", transfer);
        totals.put("gateway_vnd", gateway);

        Map<String, Object> res = new LinkedHashMap<>();
        res.put("from", from);
        res.put("to", to);
        res.put("totals", totals);
        res.put("by_sport", Collections.emptyList());
        res.put("by_method", Collections.emptyList());
        return res;
    }

    public CenterSettingsEntity getSettings() {
        return centerSettingsRepository.findById((short) 1).orElseGet(CenterSettingsEntity::new);
    }

    public List<AuditLogEntity> getAudit() {
        return auditLogRepository.findTop100ByOrderByAtDesc();
    }
}
""")

w("service/MemberService.java", """
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

    public MemberService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    public List<Map<String, Object>> searchMembers(String q) {
        List<UserEntity> users = userRepository.searchUsers(q != null ? q.trim() : "");
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

    public Map<String, Object> getMember(UUID id) {
        UserEntity u = userRepository.findById(id)
                .orElseThrow(() -> ApiException.notFound("Không tìm thấy hội viên."));
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
""")

w("service/OpsService.java", """
package com.arena3.service;

import com.arena3.entity.EquipmentItemEntity;
import com.arena3.entity.FeatureFlagEntity;
import com.arena3.repository.EquipmentItemRepository;
import com.arena3.repository.FeatureFlagRepository;
import org.springframework.stereotype.Service;

import java.util.*;

@Service
public class OpsService {

    private final FeatureFlagRepository featureFlagRepository;
    private final EquipmentItemRepository equipmentItemRepository;

    public OpsService(FeatureFlagRepository featureFlagRepository,
                      EquipmentItemRepository equipmentItemRepository) {
        this.featureFlagRepository = featureFlagRepository;
        this.equipmentItemRepository = equipmentItemRepository;
    }

    public Map<String, Boolean> getFlags() {
        Map<String, Boolean> res = new LinkedHashMap<>();
        List<FeatureFlagEntity> list = featureFlagRepository.findAll();
        for (FeatureFlagEntity f : list) {
            res.put(f.getKey(), f.isEnabled());
        }
        return res;
    }

    public List<EquipmentItemEntity> getEquipment() {
        return equipmentItemRepository.findAll();
    }

    public Map<String, Object> chatAssistant(String message) {
        Map<String, Object> res = new LinkedHashMap<>();
        String lower = message != null ? message.toLowerCase() : "";
        if (lower.contains("giờ") || lower.contains("mở cửa")) {
            res.put("reply", "Arena3 mở cửa từ 06:00 đến 22:00 tất cả các ngày trong tuần.");
        } else if (lower.contains("giá")) {
            res.put("reply", "Giá sân dao động từ 80.000đ đến 140.000đ/giờ cho sân cầu lông tùy khung giờ cao điểm.");
        } else {
            res.put("reply", "Chào bạn, tôi là trợ lý ảo Arena3. Tôi có thể hỗ trợ thông tin sân bãi, lịch học và bảng giá.");
        }
        res.put("source", "rule");
        return res;
    }
}
""")

print("Done writing additional services!")
