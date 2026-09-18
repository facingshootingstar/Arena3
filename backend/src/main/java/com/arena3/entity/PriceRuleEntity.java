package com.arena3.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.UUID;

@Entity
@Table(name = "price_rules")
@Getter
@Setter
@NoArgsConstructor
public class PriceRuleEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, length = 32)
    private String sport;

    @Column(name = "court_id")
    private UUID courtId;

    @Column(name = "day_kind", nullable = false, length = 16)
    private String dayKind; // weekday, weekend, holiday

    @Column(name = "start_local", nullable = false, length = 8)
    private String startLocal;

    @Column(name = "end_local", nullable = false, length = 8)
    private String endLocal;

    @Column(name = "price_vnd", nullable = false)
    private int priceVnd;

    @com.fasterxml.jackson.annotation.JsonProperty("is_peak")
    @Column(name = "is_peak", nullable = false)
    private boolean isPeak = false;

    @com.fasterxml.jackson.annotation.JsonProperty("is_peak")
    public boolean isPeak() {
        return isPeak;
    }

    @com.fasterxml.jackson.annotation.JsonProperty("is_peak")
    public void setPeak(boolean isPeak) {
        this.isPeak = isPeak;
    }

    @Column(name = "start_min")
    private Integer startMin;

    @Column(name = "end_min")
    private Integer endMin;

    @PrePersist
    @PreUpdate
    public void computeMinutes() {
        if (startLocal != null && startLocal.contains(":")) {
            String[] parts = startLocal.split(":");
            this.startMin = Integer.parseInt(parts[0]) * 60 + Integer.parseInt(parts[1]);
        }
        if (endLocal != null && endLocal.contains(":")) {
            String[] parts = endLocal.split(":");
            this.endMin = Integer.parseInt(parts[0]) * 60 + Integer.parseInt(parts[1]);
        }
    }
}
