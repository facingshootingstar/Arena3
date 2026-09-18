package com.arena3.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "feature_flags")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class FeatureFlagEntity {
    @Id
    @Column(name = "flag_key", length = 16)
    private String key;

    @Column(nullable = false)
    private boolean enabled = false;
}
