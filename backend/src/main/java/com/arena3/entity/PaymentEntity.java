package com.arena3.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "payments")
@Getter
@Setter
@NoArgsConstructor
public class PaymentEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, unique = true, length = 24)
    private String code;

    @Column(name = "user_id")
    private UUID userId;

    @Column(name = "shift_id")
    private UUID shiftId;

    @Column(nullable = false, length = 32)
    private String method; // cash, transfer, card, gateway, quota

    @Column(name = "amount_vnd", nullable = false)
    private int amountVnd;

    @Column(name = "vat_rate", nullable = false)
    private BigDecimal vatRate = BigDecimal.ZERO;

    @Column(nullable = false, length = 32)
    private String status = "posted"; // posted, refund_pending, refund_rejected

    @Column(name = "ref_type", nullable = false, length = 24)
    private String refType; // booking, subscription, walkin, equipment

    @Column(name = "ref_id", nullable = false)
    private UUID refId;

    @Column(name = "created_by")
    private UUID createdBy;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt = OffsetDateTime.now();
}
