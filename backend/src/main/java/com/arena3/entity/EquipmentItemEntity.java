package com.arena3.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.UUID;

@Entity
@Table(name = "equipment_items")
@Getter
@Setter
@NoArgsConstructor
public class EquipmentItemEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, unique = true, length = 24)
    private String sku;

    @Column(nullable = false, length = 80)
    private String name;

    @Column(length = 32)
    private String sport;

    @Column(nullable = false)
    private int stock = 0;

    @Column(name = "rent_vnd", nullable = false)
    private int rentVnd = 0;
}
