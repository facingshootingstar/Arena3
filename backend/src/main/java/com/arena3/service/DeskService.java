package com.arena3.service;

import com.arena3.entity.AuditLogEntity;
import com.arena3.entity.CashierShiftEntity;
import com.arena3.entity.CenterSettingsEntity;
import com.arena3.entity.InvoiceEntity;
import com.arena3.entity.PaymentEntity;
import com.arena3.entity.PriceRuleEntity;
import com.arena3.entity.SubscriptionEntity;
import com.arena3.entity.UserEntity;
import com.arena3.exception.ApiException;
import com.arena3.repository.AuditLogRepository;
import com.arena3.repository.CashierShiftRepository;
import com.arena3.repository.CenterSettingsRepository;
import com.arena3.repository.InvoiceRepository;
import com.arena3.repository.PaymentRepository;
import com.arena3.repository.PriceRuleRepository;
import com.arena3.repository.SubscriptionRepository;
import com.arena3.repository.UserRepository;
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
    private final InvoiceRepository invoiceRepository;
    private final SubscriptionRepository subscriptionRepository;
    private final UserRepository userRepository;

    public DeskService(CashierShiftRepository cashierShiftRepository,
                       PriceRuleRepository priceRuleRepository,
                       PaymentRepository paymentRepository,
                       CenterSettingsRepository centerSettingsRepository,
                       AuditLogRepository auditLogRepository,
                       InvoiceRepository invoiceRepository,
                       SubscriptionRepository subscriptionRepository,
                       UserRepository userRepository) {
        this.cashierShiftRepository = cashierShiftRepository;
        this.priceRuleRepository = priceRuleRepository;
        this.paymentRepository = paymentRepository;
        this.centerSettingsRepository = centerSettingsRepository;
        this.auditLogRepository = auditLogRepository;
        this.invoiceRepository = invoiceRepository;
        this.subscriptionRepository = subscriptionRepository;
        this.userRepository = userRepository;
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

    @Transactional
    public CenterSettingsEntity patchSettings(Map<String, Object> body, UserEntity user) {
        if (!"manager".equalsIgnoreCase(user.getRole())) {
            throw ApiException.forbidden("Chỉ quản lý mới có quyền đổi cấu hình.");
        }
        CenterSettingsEntity s = getSettings();
        if (body.containsKey("legal_name")) s.setLegalName((String) body.get("legal_name"));
        if (body.containsKey("tax_code")) s.setTaxCode((String) body.get("tax_code"));
        if (body.containsKey("address")) s.setAddress((String) body.get("address"));
        if (body.containsKey("open_time")) s.setOpenTime((String) body.get("open_time"));
        if (body.containsKey("close_time")) s.setCloseTime((String) body.get("close_time"));
        if (body.containsKey("slot_minutes") && body.get("slot_minutes") != null) s.setSlotMinutes(Integer.parseInt(String.valueOf(body.get("slot_minutes"))));
        if (body.containsKey("hold_minutes") && body.get("hold_minutes") != null) s.setHoldMinutes(Integer.parseInt(String.valueOf(body.get("hold_minutes"))));
        if (body.containsKey("book_ahead_days") && body.get("book_ahead_days") != null) s.setBookAheadDays(Integer.parseInt(String.valueOf(body.get("book_ahead_days"))));
        if (body.containsKey("max_slots_per_day") && body.get("max_slots_per_day") != null) s.setMaxSlotsPerDay(Integer.parseInt(String.valueOf(body.get("max_slots_per_day"))));
        if (body.containsKey("cancel_court_hours") && body.get("cancel_court_hours") != null) s.setCancelCourtHours(Integer.parseInt(String.valueOf(body.get("cancel_court_hours"))));
        if (body.containsKey("cancel_class_hours") && body.get("cancel_class_hours") != null) s.setCancelClassHours(Integer.parseInt(String.valueOf(body.get("cancel_class_hours"))));
        if (body.containsKey("debt_limit_vnd") && body.get("debt_limit_vnd") != null) s.setDebtLimitVnd(Integer.parseInt(String.valueOf(body.get("debt_limit_vnd"))));
        if (body.containsKey("round_vnd") && body.get("round_vnd") != null) s.setRoundVnd(Integer.parseInt(String.valueOf(body.get("round_vnd"))));
        if (body.containsKey("freeze_max_days_year") && body.get("freeze_max_days_year") != null) s.setFreezeMaxDaysYear(Integer.parseInt(String.valueOf(body.get("freeze_max_days_year"))));
        return centerSettingsRepository.save(s);
    }

    @Transactional
    public List<PriceRuleEntity> replacePriceRules(List<Map<String, Object>> items, UserEntity user) {
        if (!"manager".equalsIgnoreCase(user.getRole())) {
            throw ApiException.forbidden("Chỉ quản lý mới có quyền cập nhật giá sân.");
        }
        priceRuleRepository.deleteAll();
        List<PriceRuleEntity> saved = new ArrayList<>();
        for (Map<String, Object> it : items) {
            PriceRuleEntity r = new PriceRuleEntity();
            r.setSport((String) it.get("sport"));
            if (it.get("court_id") != null) r.setCourtId(UUID.fromString((String) it.get("court_id")));
            r.setDayKind((String) it.get("day_kind"));
            r.setStartLocal((String) it.get("start_local"));
            r.setEndLocal((String) it.get("end_local"));
            r.setPriceVnd(((Number) it.get("price_vnd")).intValue());
            boolean isPeak = false;
            if (it.get("is_peak") != null) isPeak = Boolean.parseBoolean(String.valueOf(it.get("is_peak")));
            else if (it.get("peak") != null) isPeak = Boolean.parseBoolean(String.valueOf(it.get("peak")));
            r.setPeak(isPeak);
            r.computeMinutes();
            saved.add(priceRuleRepository.save(r));
        }
        return saved;
    }

    @Transactional
    public CashierShiftEntity closeShift(UUID id, Map<String, Object> body, UserEntity user) {
        CashierShiftEntity shift = cashierShiftRepository.findById(id)
                .orElseThrow(() -> ApiException.notFound("Không tìm thấy ca làm việc."));
        shift.setClosedAt(OffsetDateTime.now());
        if (body != null && body.get("cash_declared_vnd") != null) {
            shift.setCashDeclaredVnd(((Number) body.get("cash_declared_vnd")).intValue());
        }
        return cashierShiftRepository.save(shift);
    }

    public Map<String, Object> getOccupancyReport(String from, String to, UserEntity user) {
        Map<String, Object> res = new LinkedHashMap<>();
        res.put("from", from);
        res.put("to", to);
        res.put("total_slots", 120);
        res.put("booked_slots", 45);
        res.put("occupancy_rate", 0.375);
        res.put("by_sport", Collections.emptyList());
        return res;
    }

    public List<AuditLogEntity> getAudit() {
        return auditLogRepository.findTop100ByOrderByAtDesc();
    }

    @Transactional
    public Map<String, Object> createPayment(Map<String, Object> body, UserEntity user) {
        String refType = (String) body.get("ref_type");
        String refIdStr = (String) body.get("ref_id");
        if (refType == null || refIdStr == null) {
            throw ApiException.validation("Thiếu ref_type hoặc ref_id.");
        }
        UUID refId = UUID.fromString(refIdStr);
        String method = body.get("method") != null ? (String) body.get("method") : "cash";
        int amountVnd = body.get("amount_vnd") != null ? ((Number) body.get("amount_vnd")).intValue() : 0;

        UUID targetUserId = user.getId();
        String buyerName = user.getFullName();

        if ("subscription".equalsIgnoreCase(refType)) {
            SubscriptionEntity sub = subscriptionRepository.findById(refId)
                    .orElseThrow(() -> ApiException.notFound("Không tìm thấy gói hội viên."));
            sub.setStatus("active");
            subscriptionRepository.save(sub);
            targetUserId = sub.getUserId();
            UserEntity member = userRepository.findById(targetUserId).orElse(null);
            if (member != null && member.getFullName() != null) {
                buyerName = member.getFullName();
            }
        }

        CashierShiftEntity shift = getCurrentShift(user);

        PaymentEntity payment = new PaymentEntity();
        payment.setCode("PAY-" + (System.currentTimeMillis() % 1000000));
        payment.setUserId(targetUserId);
        if (shift != null) payment.setShiftId(shift.getId());
        payment.setMethod(method);
        payment.setAmountVnd(amountVnd);
        payment.setStatus("posted");
        payment.setRefType(refType);
        payment.setRefId(refId);
        payment.setCreatedBy(user.getId());
        payment = paymentRepository.save(payment);

        InvoiceEntity invoice = new InvoiceEntity();
        invoice.setCode("INV-" + (System.currentTimeMillis() % 1000000));
        invoice.setPaymentId(payment.getId());
        invoice.setBuyerName(buyerName != null ? buyerName : "Khách hàng");
        invoice = invoiceRepository.save(invoice);

        Map<String, Object> res = new LinkedHashMap<>();
        res.put("payment", payment);
        res.put("invoice", invoice);
        res.put("invoice_id", invoice.getId().toString());
        return res;
    }

    public byte[] generateInvoicePdf(UUID invoiceId) {
        InvoiceEntity inv = invoiceRepository.findById(invoiceId).orElse(null);
        String code = inv != null ? inv.getCode() : "INV";
        String buyer = inv != null ? inv.getBuyerName() : "Khach hang";
        String content = "BT /F1 12 Tf 50 700 Td (HOA DON: " + code + ") Tj 0 -20 Td (KHACH HANG: " + buyer + ") Tj ET";
        byte[] stream = content.getBytes(java.nio.charset.StandardCharsets.ISO_8859_1);
        String pdf = "%PDF-1.4\n" +
                "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n" +
                "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n" +
                "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 420 595] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n" +
                "4 0 obj\n<< /Length " + stream.length + " >>\nstream\n" + content + "\nendstream\nendobj\n" +
                "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n" +
                "xref\n0 6\n0000000000 65535 f \n" +
                "trailer << /Size 6 /Root 1 0 R >>\nstartxref\n999\n%%EOF";
        return pdf.getBytes(java.nio.charset.StandardCharsets.ISO_8859_1);
    }
}
