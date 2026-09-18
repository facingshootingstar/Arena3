package com.arena3.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;

@Entity
@Table(name = "center_settings")
@Getter
@Setter
@NoArgsConstructor
public class CenterSettingsEntity {
    @Id
    private Short id = 1;

    @Column(nullable = false)
    private String timezone = "Asia/Ho_Chi_Minh";

    @Column(nullable = false, length = 3)
    private String currency = "VND";

    @Column(name = "open_time", nullable = false)
    private String openTime = "06:00";

    @Column(name = "close_time", nullable = false)
    private String closeTime = "22:00";

    @Column(name = "slot_minutes", nullable = false)
    private int slotMinutes = 60;

    @Column(name = "hold_minutes", nullable = false)
    private int holdMinutes = 5;

    @Column(name = "book_ahead_days", nullable = false)
    private int bookAheadDays = 7;

    @Column(name = "max_slots_per_day", nullable = false)
    private int maxSlotsPerDay = 2;

    @Column(name = "cancel_court_hours", nullable = false)
    private int cancelCourtHours = 2;

    @Column(name = "cancel_class_hours", nullable = false)
    private int cancelClassHours = 4;

    @Column(name = "noshow_grace_minutes", nullable = false)
    private int noshowGraceMinutes = 10;

    @Column(name = "checkin_before_minutes", nullable = false)
    private int checkinBeforeMinutes = 15;

    @Column(name = "debt_limit_vnd", nullable = false)
    private int debtLimitVnd = 500000;

    @Column(name = "refund_manager_vnd", nullable = false)
    private int refundManagerVnd = 1000000;

    @Column(name = "freeze_max_days_year", nullable = false)
    private int freezeMaxDaysYear = 30;

    @Column(name = "minor_age", nullable = false)
    private int minorAge = 16;

    @Column(name = "vat_rate", nullable = false)
    private BigDecimal vatRate = BigDecimal.ZERO;

    @Column(name = "round_vnd", nullable = false)
    private int roundVnd = 1000;

    @Column(name = "waitlist_offer_hours", nullable = false)
    private int waitlistOfferHours = 2;

    @Column(name = "deposit_pct_activates")
    private Integer depositPctActivates;

    @Column(name = "tax_code", length = 20)
    private String taxCode;

    @Column(name = "legal_name", length = 190)
    private String legalName = "Arena3 Sports Center";

    @Column(columnDefinition = "TEXT")
    private String address = "TP. Hồ Chí Minh";
}
