package com.arena3.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "subscriptions")
@Getter
@Setter
@NoArgsConstructor
public class SubscriptionEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "plan_id", nullable = false)
    private UUID planId;

    @Column(name = "sport_scope", nullable = false, length = 32)
    private String sportScope;

    @Column(name = "start_on", nullable = false)
    private LocalDate startOn;

    @Column(name = "end_on", nullable = false)
    private LocalDate endOn;

    @Column(nullable = false, length = 32)
    private String status = "pending";

    @Column(name = "court_hours_left", nullable = false)
    private BigDecimal courtHoursLeft = BigDecimal.ZERO;

    @Column(name = "session_left")
    private Integer sessionLeft;

    @Column(name = "frozen_days", nullable = false)
    private int frozenDays = 0;
}
