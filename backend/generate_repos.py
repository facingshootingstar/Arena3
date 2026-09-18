import os

BASE = os.path.dirname(os.path.abspath(__file__))
JAVA = os.path.join(BASE, "src", "main", "java", "com", "arena3")

def w(path, content):
    p = os.path.join(JAVA, path)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    with open(p, "w", encoding="utf-8") as f:
        f.write(content.strip() + "\n")
    print("Wrote:", path)

w("repository/UserRepository.java", """
package com.arena3.repository;

import com.arena3.entity.UserEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface UserRepository extends JpaRepository<UserEntity, UUID> {
    Optional<UserEntity> findByPhone(String phone);
    Optional<UserEntity> findByEmail(String email);
    Optional<UserEntity> findByMemberCode(String memberCode);

    @Query("SELECT u FROM UserEntity u WHERE u.phone = :login OR u.email = :login")
    Optional<UserEntity> findByLogin(@Param("login") String login);

    List<UserEntity> findByRole(String role);

    @Query("SELECT u FROM UserEntity u WHERE (:q IS NULL OR LOWER(u.fullName) LIKE LOWER(CONCAT('%', :q, '%')) OR u.phone LIKE CONCAT('%', :q, '%') OR LOWER(u.memberCode) LIKE LOWER(CONCAT('%', :q, '%')))")
    List<UserEntity> searchUsers(@Param("q") String q);
}
""")

w("repository/CenterSettingsRepository.java", """
package com.arena3.repository;

import com.arena3.entity.CenterSettingsEntity;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CenterSettingsRepository extends JpaRepository<CenterSettingsEntity, Short> {
}
""")

w("repository/CoachSportRepository.java", """
package com.arena3.repository;

import com.arena3.entity.CoachSportEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface CoachSportRepository extends JpaRepository<CoachSportEntity, CoachSportEntity.CoachSportId> {
    List<CoachSportEntity> findByUserId(UUID userId);
}
""")

w("repository/MembershipPlanRepository.java", """
package com.arena3.repository;

import com.arena3.entity.MembershipPlanEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface MembershipPlanRepository extends JpaRepository<MembershipPlanEntity, UUID> {
    List<MembershipPlanEntity> findByIsOnSaleTrue();
}
""")

w("repository/SubscriptionRepository.java", """
package com.arena3.repository;

import com.arena3.entity.SubscriptionEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface SubscriptionRepository extends JpaRepository<SubscriptionEntity, UUID> {
    List<SubscriptionEntity> findByUserId(UUID userId);
    List<SubscriptionEntity> findByUserIdAndStatus(UUID userId, String status);
}
""")

w("repository/CourtRepository.java", """
package com.arena3.repository;

import com.arena3.entity.CourtEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface CourtRepository extends JpaRepository<CourtEntity, UUID> {
    Optional<CourtEntity> findByCourtCode(String courtCode);
    List<CourtEntity> findBySport(String sport);
}
""")

w("repository/OccupancyRepository.java", """
package com.arena3.repository;

import com.arena3.entity.OccupancyEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public interface OccupancyRepository extends JpaRepository<OccupancyEntity, UUID> {
    @Query("SELECT o FROM OccupancyEntity o WHERE o.courtId = :courtId AND o.startAt < :endAt AND o.endAt > :startAt")
    List<OccupancyEntity> findOverlapping(
            @Param("courtId") UUID courtId,
            @Param("startAt") OffsetDateTime startAt,
            @Param("endAt") OffsetDateTime endAt
    );

    @Query("SELECT o FROM OccupancyEntity o WHERE o.startAt < :endAt AND o.endAt > :startAt")
    List<OccupancyEntity> findInWindow(
            @Param("startAt") OffsetDateTime startAt,
            @Param("endAt") OffsetDateTime endAt
    );

    List<OccupancyEntity> findByConvertGroupId(UUID convertGroupId);
}
""")

w("repository/CoachOccupancyRepository.java", """
package com.arena3.repository;

import com.arena3.entity.CoachOccupancyEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public interface CoachOccupancyRepository extends JpaRepository<CoachOccupancyEntity, UUID> {
    @Query("SELECT c FROM CoachOccupancyEntity c WHERE c.coachId = :coachId AND c.startAt < :endAt AND c.endAt > :startAt")
    List<CoachOccupancyEntity> findOverlapping(
            @Param("coachId") UUID coachId,
            @Param("startAt") OffsetDateTime startAt,
            @Param("endAt") OffsetDateTime endAt
    );

    void deleteBySessionId(UUID sessionId);
}
""")

w("repository/PriceRuleRepository.java", """
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
""")

w("repository/ClassRepository.java", """
package com.arena3.repository;

import com.arena3.entity.ClassEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface ClassRepository extends JpaRepository<ClassEntity, UUID> {
    List<ClassEntity> findByCoachId(UUID coachId);
    List<ClassEntity> findByStatus(String status);
}
""")

w("repository/SessionRepository.java", """
package com.arena3.repository;

import com.arena3.entity.SessionEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public interface SessionRepository extends JpaRepository<SessionEntity, UUID> {
    List<SessionEntity> findByClassId(UUID classId);
    List<SessionEntity> findByCourtId(UUID courtId);
    List<SessionEntity> findByStartAtBetween(OffsetDateTime start, OffsetDateTime end);
}
""")

w("repository/EnrollmentRepository.java", """
package com.arena3.repository;

import com.arena3.entity.EnrollmentEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface EnrollmentRepository extends JpaRepository<EnrollmentEntity, UUID> {
    List<EnrollmentEntity> findByClassId(UUID classId);
    List<EnrollmentEntity> findByUserId(UUID userId);
    Optional<EnrollmentEntity> findByClassIdAndUserId(UUID classId, UUID userId);
}
""")

w("repository/CourtBookingRepository.java", """
package com.arena3.repository;

import com.arena3.entity.CourtBookingEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface CourtBookingRepository extends JpaRepository<CourtBookingEntity, UUID> {
    Optional<CourtBookingEntity> findByCode(String code);
    List<CourtBookingEntity> findByUserId(UUID userId);
    List<CourtBookingEntity> findByUserIdAndStatus(UUID userId, String status);
    List<CourtBookingEntity> findByGuestPhoneAndStatus(String guestPhone, String status);
}
""")

w("repository/CashierShiftRepository.java", """
package com.arena3.repository;

import com.arena3.entity.CashierShiftEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface CashierShiftRepository extends JpaRepository<CashierShiftEntity, UUID> {
    Optional<CashierShiftEntity> findFirstByReceptionistIdAndClosedAtIsNull(UUID receptionistId);
    Optional<CashierShiftEntity> findFirstByClosedAtIsNullOrderByOpenedAtDesc();
}
""")

w("repository/PaymentRepository.java", """
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
""")

w("repository/InvoiceRepository.java", """
package com.arena3.repository;

import com.arena3.entity.InvoiceEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface InvoiceRepository extends JpaRepository<InvoiceEntity, UUID> {
    Optional<InvoiceEntity> findByPaymentId(UUID paymentId);
    Optional<InvoiceEntity> findByCode(String code);
}
""")

w("repository/InvoiceLineRepository.java", """
package com.arena3.repository;

import com.arena3.entity.InvoiceLineEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface InvoiceLineRepository extends JpaRepository<InvoiceLineEntity, UUID> {
    List<InvoiceLineEntity> findByInvoiceId(UUID invoiceId);
}
""")

w("repository/EquipmentItemRepository.java", """
package com.arena3.repository;

import com.arena3.entity.EquipmentItemEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface EquipmentItemRepository extends JpaRepository<EquipmentItemEntity, UUID> {
    Optional<EquipmentItemEntity> findBySku(String sku);
}
""")

w("repository/EquipmentLoanRepository.java", """
package com.arena3.repository;

import com.arena3.entity.EquipmentLoanEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface EquipmentLoanRepository extends JpaRepository<EquipmentLoanEntity, UUID> {
    List<EquipmentLoanEntity> findByStatus(String status);
}
""")

w("repository/AttendanceRepository.java", """
package com.arena3.repository;

import com.arena3.entity.AttendanceEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface AttendanceRepository extends JpaRepository<AttendanceEntity, UUID> {
    List<AttendanceEntity> findBySessionId(UUID sessionId);
    Optional<AttendanceEntity> findBySessionIdAndUserId(UUID sessionId, UUID userId);
}
""")

w("repository/TrainingPlanRepository.java", """
package com.arena3.repository;

import com.arena3.entity.TrainingPlanEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface TrainingPlanRepository extends JpaRepository<TrainingPlanEntity, UUID> {
    List<TrainingPlanEntity> findByUserId(UUID userId);
    List<TrainingPlanEntity> findByClassId(UUID classId);
}
""")

w("repository/TicketRepository.java", """
package com.arena3.repository;

import com.arena3.entity.TicketEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface TicketRepository extends JpaRepository<TicketEntity, UUID> {
    List<TicketEntity> findByUserId(UUID userId);
}
""")

w("repository/AuditLogRepository.java", """
package com.arena3.repository;

import com.arena3.entity.AuditLogEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface AuditLogRepository extends JpaRepository<AuditLogEntity, Long> {
    List<AuditLogEntity> findTop100ByOrderByAtDesc();
}
""")

w("repository/FeatureFlagRepository.java", """
package com.arena3.repository;

import com.arena3.entity.FeatureFlagEntity;
import org.springframework.data.jpa.repository.JpaRepository;

public interface FeatureFlagRepository extends JpaRepository<FeatureFlagEntity, String> {
}
""")

w("repository/CodeCounterRepository.java", """
package com.arena3.repository;

import com.arena3.entity.CodeCounterEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface CodeCounterRepository extends JpaRepository<CodeCounterEntity, CodeCounterEntity.CodeCounterId> {
    Optional<CodeCounterEntity> findByKindAndYyyy(String kind, int yyyy);
}
""")

w("repository/SessionAuthRepository.java", """
package com.arena3.repository;

import com.arena3.entity.SessionAuthEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface SessionAuthRepository extends JpaRepository<SessionAuthEntity, UUID> {
    Optional<SessionAuthEntity> findByTokenHash(String tokenHash);
    void deleteByUserId(UUID userId);
    void deleteByTokenHash(String tokenHash);
}
""")

w("repository/OtpChallengeRepository.java", """
package com.arena3.repository;

import com.arena3.entity.OtpChallengeEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface OtpChallengeRepository extends JpaRepository<OtpChallengeEntity, UUID> {
    Optional<OtpChallengeEntity> findTopByPhoneAndPurposeOrderByExpiresAtDesc(String phone, String purpose);
}
""")

w("repository/OutboxRepository.java", """
package com.arena3.repository;

import com.arena3.entity.OutboxEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface OutboxRepository extends JpaRepository<OutboxEntity, UUID> {
    List<OutboxEntity> findByUserIdAndChannelAndSentAtIsNotNull(UUID userId, String channel);
}
""")

print("Done writing repositories!")
