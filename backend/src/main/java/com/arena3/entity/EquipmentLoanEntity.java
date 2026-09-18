package com.arena3.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "equipment_loans")
@Getter
@Setter
@NoArgsConstructor
public class EquipmentLoanEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "item_id", nullable = false)
    private UUID itemId;

    @Column(name = "booking_id")
    private UUID bookingId;

    @Column(nullable = false, length = 16)
    private String phone;

    @Column(nullable = false)
    private int qty;

    @Column(nullable = false, length = 32)
    private String status = "out"; // out, returned, lost

    @Column(name = "due_at", nullable = false)
    private OffsetDateTime dueAt;

    @Column(name = "returned_at")
    private OffsetDateTime returnedAt;
}
