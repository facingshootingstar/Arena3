package com.arena3.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "court_bookings")
@Getter
@Setter
@NoArgsConstructor
public class CourtBookingEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, unique = true, length = 24)
    private String code;

    @Column(name = "court_id", nullable = false)
    private UUID courtId;

    @Column(name = "user_id")
    private UUID userId;

    @Column(name = "guest_name", length = 120)
    private String guestName;

    @Column(name = "guest_phone", length = 16)
    private String guestPhone;

    @Column(name = "start_at", nullable = false)
    private OffsetDateTime startAt;

    @Column(name = "end_at", nullable = false)
    private OffsetDateTime endAt;

    @Column(nullable = false, length = 32)
    private String status; // hold, confirmed, in_use, completed, cancelled, no_show

    @Column(nullable = false, length = 12)
    private String channel = "app";

    @Column(name = "price_vnd", nullable = false)
    private int priceVnd;

    @Column(name = "discount_pct", nullable = false)
    private int discountPct = 0;

    @Column(name = "vat_rate", nullable = false)
    private BigDecimal vatRate = BigDecimal.ZERO;

    @Column(name = "hold_until")
    private OffsetDateTime holdUntil;

    @Column(name = "occupancy_id")
    private UUID occupancyId;

    @Column(name = "quota_hours", nullable = false)
    private BigDecimal quotaHours = BigDecimal.ZERO;
}
