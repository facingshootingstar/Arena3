package com.arena3.repository;

import com.arena3.entity.PaymentEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PaymentRepository extends JpaRepository<PaymentEntity, UUID> {
    Optional<PaymentEntity> findByCode(String code);
    List<PaymentEntity> findByUserId(UUID userId);
    List<PaymentEntity> findByRefTypeAndRefId(String refType, UUID refId);
}
