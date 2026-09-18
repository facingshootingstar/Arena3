package com.arena3.repository;

import com.arena3.entity.InvoiceLineEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface InvoiceLineRepository extends JpaRepository<InvoiceLineEntity, UUID> {
    List<InvoiceLineEntity> findByInvoiceId(UUID invoiceId);
}
