package com.arena3.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.io.Serializable;

@Entity
@Table(name = "code_counters")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@IdClass(CodeCounterEntity.CodeCounterId.class)
public class CodeCounterEntity {
    @Id
    @Column(length = 16)
    private String kind;

    @Id
    private int yyyy;

    @Column(nullable = false)
    private int n;

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CodeCounterId implements Serializable {
        private String kind;
        private int yyyy;
    }
}
