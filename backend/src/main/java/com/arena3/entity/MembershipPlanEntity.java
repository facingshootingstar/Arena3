package com.arena3.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.UUID;

@Entity
@Table(name = "membership_plans")
@Getter
@Setter
@NoArgsConstructor
public class MembershipPlanEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, length = 80)
    private String name;

    @Column(name = "sport_scope", nullable = false, length = 32)
    private String sportScope;

    @Column(name = "duration_days")
    private Integer durationDays;

    @Column(name = "session_quota")
    private Integer sessionQuota;

    @Column(name = "court_hours", nullable = false)
    private int courtHours = 0;

    @Column(name = "court_discount_pct", nullable = false)
    private int courtDiscountPct = 0;

    @Column(name = "price_vnd", nullable = false)
    private int priceVnd;

    @com.fasterxml.jackson.annotation.JsonProperty("is_on_sale")
    @Column(name = "is_on_sale", nullable = false)
    private boolean isOnSale = true;

    @com.fasterxml.jackson.annotation.JsonProperty("is_on_sale")
    public boolean isOnSale() {
        return isOnSale;
    }

    @com.fasterxml.jackson.annotation.JsonProperty("is_on_sale")
    public void setOnSale(boolean isOnSale) {
        this.isOnSale = isOnSale;
    }

    @Column(name = "carry_over_hours", nullable = false)
    private boolean carryOverHours = false;
}
