package com.arena3.repository;

import com.arena3.entity.PriceRuleEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface PriceRuleRepository extends JpaRepository<PriceRuleEntity, UUID> {
    @Query("SELECT p FROM PriceRuleEntity p WHERE p.sport = :sport AND p.dayKind = :dayKind AND p.startMin <= :minute AND p.endMin > :minute")
    List<PriceRuleEntity> findMatchingRules(
            @Param("sport") String sport,
            @Param("dayKind") String dayKind,
            @Param("minute") int minute
    );
}
