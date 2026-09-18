package com.arena3.service;

import com.arena3.entity.CourtBookingEntity;
import com.arena3.entity.CourtEntity;
import com.arena3.entity.OccupancyEntity;
import com.arena3.entity.UserEntity;
import com.arena3.exception.ApiException;
import com.arena3.repository.CourtBookingRepository;
import com.arena3.repository.CourtRepository;
import com.arena3.repository.InvoiceRepository;
import com.arena3.repository.OccupancyRepository;
import com.arena3.repository.PaymentRepository;
import org.mockito.Mockito;
import org.testng.Assert;
import org.testng.annotations.BeforeMethod;
import org.testng.annotations.Test;

import java.time.OffsetDateTime;
import java.util.*;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/**
 * Module 2 Test: CourtBookingService
 * Kiểm thử quy tắc giữ chỗ (Hold Booking), phát hiện trùng lịch (Overlap Conflict),
 * và tự động giải phóng lượt giữ chỗ cũ để chống chiếm dụng sân.
 */
public class CourtBookingServiceTest {

    private CourtRepository courtRepository;
    private OccupancyRepository occupancyRepository;
    private CourtBookingRepository courtBookingRepository;
    private PricingService pricingService;
    private PaymentRepository paymentRepository;
    private InvoiceRepository invoiceRepository;
    private CourtBookingService courtBookingService;

    @BeforeMethod
    public void setUp() {
        courtRepository = Mockito.mock(CourtRepository.class);
        occupancyRepository = Mockito.mock(OccupancyRepository.class);
        courtBookingRepository = Mockito.mock(CourtBookingRepository.class);
        pricingService = Mockito.mock(PricingService.class);
        paymentRepository = Mockito.mock(PaymentRepository.class);
        invoiceRepository = Mockito.mock(InvoiceRepository.class);

        courtBookingService = new CourtBookingService(
                courtRepository,
                occupancyRepository,
                courtBookingRepository,
                pricingService,
                paymentRepository,
                invoiceRepository
        );
    }

    @Test(description = "Giữ chỗ sân thành công khi khung giờ còn trống")
    public void testHoldBookingSuccess() {
        UUID courtId = UUID.randomUUID();
        OffsetDateTime startAt = OffsetDateTime.parse("2026-09-17T18:00:00+07:00");

        CourtEntity court = new CourtEntity();
        court.setId(courtId);
        court.setCourtCode("CL-01");
        court.setSport("badminton");
        court.setStatus("ready");

        UserEntity user = new UserEntity();
        user.setId(UUID.randomUUID());
        user.setFullName("Nguyễn Văn A");

        when(courtRepository.findById(courtId)).thenReturn(Optional.of(court));
        when(occupancyRepository.findOverlapping(eq(courtId), any(), any())).thenReturn(Collections.emptyList());

        PricingService.PriceResult priceRes = new PricingService.PriceResult();
        priceRes.setPriceVnd(140000);
        priceRes.setPeak(true);
        when(pricingService.lookupPrice(eq("badminton"), eq(courtId), eq(startAt))).thenReturn(priceRes);
        when(pricingService.memberDiscount(any(), any())).thenReturn(new PricingService.DiscountResult());
        when(pricingService.applyDiscount(eq(140000), eq(0), eq(1000))).thenReturn(140000);

        when(courtBookingRepository.save(any(CourtBookingEntity.class))).thenAnswer(invocation -> {
            CourtBookingEntity b = invocation.getArgument(0);
            b.setId(UUID.randomUUID());
            return b;
        });

        Map<String, Object> body = new HashMap<>();
        body.put("court_id", courtId.toString());
        body.put("start_at", startAt.toString());

        Map<String, Object> response = courtBookingService.holdBooking(body, user);

        Assert.assertNotNull(response);
        Assert.assertEquals(response.get("price"), 140000);
        Assert.assertEquals(response.get("is_peak"), true);

        CourtBookingEntity savedBooking = (CourtBookingEntity) response.get("booking");
        Assert.assertNotNull(savedBooking);
        Assert.assertEquals(savedBooking.getStatus(), "hold");
        Assert.assertEquals(savedBooking.getCourtId(), courtId);

        // Xác nhận đã lưu occupancy loại 'hold'
        verify(occupancyRepository, times(1)).save(argThat(occ ->
                "hold".equals(occ.getKind()) && occ.getCourtId().equals(courtId)
        ));
    }

    @Test(expectedExceptions = ApiException.class, description = "Phát hiện trùng lịch: ném lỗi CONFLICT_SLOT khi khung giờ đã bị chiếm")
    public void testHoldBookingOverlapConflict() {
        UUID courtId = UUID.randomUUID();
        OffsetDateTime startAt = OffsetDateTime.parse("2026-09-17T18:00:00+07:00");

        CourtEntity court = new CourtEntity();
        court.setId(courtId);
        court.setStatus("ready");
        court.setSport("badminton");

        when(courtRepository.findById(courtId)).thenReturn(Optional.of(court));

        // Giả lập đã có 1 suất chiếm dụng (Occupancy) trong khung giờ này
        OccupancyEntity existingOcc = new OccupancyEntity();
        existingOcc.setCourtId(courtId);
        existingOcc.setKind("booking");
        when(occupancyRepository.findOverlapping(eq(courtId), any(), any())).thenReturn(List.of(existingOcc));

        Map<String, Object> body = new HashMap<>();
        body.put("court_id", courtId.toString());
        body.put("start_at", startAt.toString());

        try {
            courtBookingService.holdBooking(body, null);
        } catch (ApiException ex) {
            Assert.assertEquals(ex.getCode(), "CONFLICT_SLOT", "Mã lỗi phải là CONFLICT_SLOT");
            Assert.assertEquals(ex.getStatus(), 409, "HTTP status phải là 409 Conflict");
            throw ex;
        }
    }

    @Test(description = "Chống chiếm dụng sân: Khách hàng giữ sân mới thì lượt giữ chỗ cũ tự động bị hủy và giải phóng")
    public void testHoldBookingReplacesOldHold() {
        UUID courtId = UUID.randomUUID();
        OffsetDateTime startAt = OffsetDateTime.parse("2026-09-17T19:00:00+07:00");

        UserEntity user = new UserEntity();
        UUID userId = UUID.randomUUID();
        user.setId(userId);

        CourtEntity court = new CourtEntity();
        court.setId(courtId);
        court.setStatus("ready");
        court.setSport("badminton");

        // Giả lập người này đã có 1 lượt giữ chỗ cũ
        UUID oldOccId = UUID.randomUUID();
        CourtBookingEntity oldHold = new CourtBookingEntity();
        oldHold.setId(UUID.randomUUID());
        oldHold.setUserId(userId);
        oldHold.setStatus("hold");
        oldHold.setOccupancyId(oldOccId);

        when(courtRepository.findById(courtId)).thenReturn(Optional.of(court));
        when(courtBookingRepository.findByUserIdAndStatus(userId, "hold")).thenReturn(List.of(oldHold));
        when(occupancyRepository.findOverlapping(eq(courtId), any(), any())).thenReturn(Collections.emptyList());

        PricingService.PriceResult priceRes = new PricingService.PriceResult();
        priceRes.setPriceVnd(140000);
        when(pricingService.lookupPrice(any(), any(), any())).thenReturn(priceRes);
        when(pricingService.memberDiscount(any(), any())).thenReturn(new PricingService.DiscountResult());
        when(courtBookingRepository.save(any(CourtBookingEntity.class))).thenAnswer(i -> i.getArgument(0));

        Map<String, Object> body = new HashMap<>();
        body.put("court_id", courtId.toString());
        body.put("start_at", startAt.toString());

        courtBookingService.holdBooking(body, user);

        // Kiểm tra lượt giữ chỗ cũ đã bị hủy và xóa occupancy
        Assert.assertEquals(oldHold.getStatus(), "cancelled", "Lượt giữ chỗ cũ phải chuyển sang cancelled");
        verify(occupancyRepository, times(1)).deleteById(oldOccId);
    }

    @Test(expectedExceptions = ApiException.class, description = "Từ chối giữ chỗ nếu sân đang ở trạng thái bảo trì (BR-12)")
    public void testHoldBookingCourtInMaintenance() {
        UUID courtId = UUID.randomUUID();
        CourtEntity court = new CourtEntity();
        court.setId(courtId);
        court.setStatus("maintenance"); // Sân bảo trì

        when(courtRepository.findById(courtId)).thenReturn(Optional.of(court));

        Map<String, Object> body = new HashMap<>();
        body.put("court_id", courtId.toString());
        body.put("start_at", "2026-09-17T18:00:00+07:00");

        try {
            courtBookingService.holdBooking(body, null);
        } catch (ApiException ex) {
            Assert.assertEquals(ex.getBr(), "BR-12", "Phải báo vi phạm quy tắc BR-12");
            throw ex;
        }
    }

    @Test(description = "Hủy lượt giữ chỗ: giải phóng occupancy và đổi trạng thái sang cancelled")
    public void testCancelBookingSuccess() {
        UUID bookingId = UUID.randomUUID();
        UUID occId = UUID.randomUUID();

        CourtBookingEntity b = new CourtBookingEntity();
        b.setId(bookingId);
        b.setStatus("hold");
        b.setOccupancyId(occId);

        when(courtBookingRepository.findById(bookingId)).thenReturn(Optional.of(b));

        Map<String, Object> res = courtBookingService.cancelBooking(bookingId, null);

        Assert.assertTrue((Boolean) res.get("success"));
        Assert.assertEquals(b.getStatus(), "cancelled");
        Assert.assertNull(b.getOccupancyId());
        verify(occupancyRepository, times(1)).deleteById(occId);
    }
}
