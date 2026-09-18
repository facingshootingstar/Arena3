package com.arena3.service;

import com.arena3.entity.CourtBookingEntity;
import com.arena3.entity.CourtEntity;
import com.arena3.entity.InvoiceEntity;
import com.arena3.entity.OccupancyEntity;
import com.arena3.entity.PaymentEntity;
import com.arena3.entity.UserEntity;
import com.arena3.exception.ApiException;
import com.arena3.repository.CourtBookingRepository;
import com.arena3.repository.CourtRepository;
import com.arena3.repository.InvoiceRepository;
import com.arena3.repository.OccupancyRepository;
import com.arena3.repository.PaymentRepository;
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
    private final PaymentRepository paymentRepository;
    private final InvoiceRepository invoiceRepository;

    public CourtBookingService(CourtRepository courtRepository,
                               OccupancyRepository occupancyRepository,
                               CourtBookingRepository courtBookingRepository,
                               PricingService pricingService,
                               PaymentRepository paymentRepository,
                               InvoiceRepository invoiceRepository) {
        this.courtRepository = courtRepository;
        this.occupancyRepository = occupancyRepository;
        this.courtBookingRepository = courtBookingRepository;
        this.pricingService = pricingService;
        this.paymentRepository = paymentRepository;
        this.invoiceRepository = invoiceRepository;
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
            s.put("ref_id", o.getRefId() != null ? o.getRefId().toString() : null);
            s.put("convert_group_id", o.getConvertGroupId() != null ? o.getConvertGroupId().toString() : null);
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

        UUID occId = UUID.randomUUID();

        // Create booking
        CourtBookingEntity booking = new CourtBookingEntity();
        booking.setCode("BK-" + (System.currentTimeMillis() % 1000000));
        booking.setCourtId(courtId);
        if (body.get("guest_name") != null && !((String) body.get("guest_name")).isBlank()) {
            booking.setGuestName((String) body.get("guest_name"));
            booking.setGuestPhone((String) body.get("guest_phone"));
        } else if (user != null) {
            booking.setUserId(user.getId());
        }
        booking.setStartAt(startAt);
        booking.setEndAt(endAt);
        booking.setStatus("hold");
        booking.setPriceVnd(finalPrice);
        booking.setDiscountPct(discRes.getPct());
        booking.setHoldUntil(OffsetDateTime.now().plusMinutes(5));
        booking.setOccupancyId(occId);
        booking = courtBookingRepository.save(booking);

        // Create occupancy
        OccupancyEntity occ = new OccupancyEntity();
        occ.setId(occId);
        occ.setCourtId(courtId);
        occ.setStartAt(startAt);
        occ.setEndAt(endAt);
        occ.setKind("hold");
        occ.setRefId(booking.getId());
        occupancyRepository.save(occ);

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

    @Transactional
    public Map<String, Object> confirmBooking(UUID bookingId, String method, UserEntity user) {
        CourtBookingEntity b = courtBookingRepository.findById(bookingId)
                .orElseThrow(() -> ApiException.notFound("Không tìm thấy booking."));
        if (!"hold".equalsIgnoreCase(b.getStatus())) {
            throw ApiException.conflictState("Booking không còn ở trạng thái hold.");
        }
        b.setStatus("confirmed");
        if (b.getOccupancyId() != null) {
            OccupancyEntity occ = occupancyRepository.findById(b.getOccupancyId()).orElse(null);
            if (occ != null) {
                occ.setKind("booking");
                occupancyRepository.save(occ);
            }
        }
        b = courtBookingRepository.save(b);

        PaymentEntity payment = new PaymentEntity();
        payment.setCode("PAY-" + (System.currentTimeMillis() % 1000000));
        payment.setUserId(b.getUserId());
        payment.setMethod(method != null ? method : "cash");
        payment.setAmountVnd(b.getPriceVnd());
        payment.setRefType("booking");
        payment.setRefId(b.getId());
        payment.setStatus("posted");
        if (user != null) payment.setCreatedBy(user.getId());
        payment = paymentRepository.save(payment);

        InvoiceEntity invoice = new InvoiceEntity();
        invoice.setCode("INV-" + (System.currentTimeMillis() % 1000000));
        invoice.setPaymentId(payment.getId());
        String buyer = b.getGuestName() != null && !b.getGuestName().isBlank()
                ? b.getGuestName()
                : (user != null ? user.getFullName() : "Khách vãng lai");
        invoice.setBuyerName(buyer);
        invoice = invoiceRepository.save(invoice);

        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("booking", b);
        resp.put("payment", payment);
        resp.put("invoice_id", invoice.getId().toString());
        resp.put("invoice", invoice);
        return resp;
    }

    @Transactional
    public Map<String, Object> checkInBooking(UUID bookingId, UserEntity user) {
        CourtBookingEntity b = courtBookingRepository.findById(bookingId)
                .orElseThrow(() -> ApiException.notFound("Không tìm thấy booking."));
        b.setStatus("checked_in");
        b = courtBookingRepository.save(b);

        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("booking", b);
        return resp;
    }

    public CourtBookingEntity getBooking(UUID bookingId, UserEntity user) {
        return courtBookingRepository.findById(bookingId)
                .orElseThrow(() -> ApiException.notFound("Không tìm thấy booking."));
    }

    @Transactional
    public Map<String, Object> walkIn(Map<String, Object> body, UserEntity user) {
        Map<String, Object> holdRes = holdBooking(body, user);
        CourtBookingEntity b = (CourtBookingEntity) holdRes.get("booking");
        String method = body.get("method") != null ? (String) body.get("method") : "cash";
        return confirmBooking(b.getId(), method, user);
    }

    @Transactional
    public Map<String, Object> convertSlot(Map<String, Object> body, UserEntity user) {
        UUID courtId = UUID.fromString((String) body.get("court_id"));
        OffsetDateTime startAt = OffsetDateTime.parse((String) body.get("start_at"));
        OffsetDateTime endAt = OffsetDateTime.parse((String) body.get("end_at"));

        CourtEntity court = courtRepository.findById(courtId)
                .orElseThrow(() -> ApiException.notFound("Không tìm thấy sân."));
        if (!court.isConvertible()) {
            throw ApiException.conflict("Sân không hỗ trợ chuyển đổi / gộp sân.");
        }

        List<OccupancyEntity> overlaps = occupancyRepository.findOverlapping(courtId, startAt, endAt);
        if (!overlaps.isEmpty()) {
            throw ApiException.conflictSlot("Không convert — sân hoặc khung giờ đang bận.");
        }

        UUID groupId = UUID.randomUUID();
        OccupancyEntity occ = new OccupancyEntity();
        occ.setCourtId(courtId);
        occ.setStartAt(startAt);
        occ.setEndAt(endAt);
        occ.setKind("convert");
        occ.setConvertGroupId(groupId);
        occ = occupancyRepository.save(occ);

        Map<String, Object> res = new LinkedHashMap<>();
        res.put("occupancy_id", occ.getId().toString());
        res.put("ref", groupId.toString());
        return res;
    }

    @Transactional
    public Map<String, Object> convertRelease(UUID groupId, UserEntity user) {
        List<OccupancyEntity> occs = occupancyRepository.findByConvertGroupId(groupId);
        occupancyRepository.deleteAll(occs);
        return Map.of("ok", true);
    }
}
