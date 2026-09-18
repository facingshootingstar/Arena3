package com.arena3.repository;

import com.arena3.entity.InvoiceEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface InvoiceRepository extends JpaRepository<InvoiceEntity, UUID> {
    Optional<InvoiceEntity> findByPaymentId(UUID paymentId);
    Optional<InvoiceEntity> findByCode(String code);
}
