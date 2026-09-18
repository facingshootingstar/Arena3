package com.arena3.repository;

import com.arena3.entity.CashierShiftEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface CashierShiftRepository extends JpaRepository<CashierShiftEntity, UUID> {
    Optional<CashierShiftEntity> findFirstByReceptionistIdAndClosedAtIsNull(UUID receptionistId);
    Optional<CashierShiftEntity> findFirstByClosedAtIsNullOrderByOpenedAtDesc();
}
