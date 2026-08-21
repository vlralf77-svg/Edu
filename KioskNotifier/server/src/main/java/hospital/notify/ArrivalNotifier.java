package hospital.notify;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * 접수 API 커밋 이후에 알림을 발행한다.
 * 접수 로직에서: publisher.publishEvent(new ArrivalNotifier.Event(...));
 */
@Component
public class ArrivalNotifier {

    public record Event(String roomCd, String msgType, String patientNo, String patientNm,
                        String doctorNm, String memo) {}

    private final JdbcTemplate jdbc;
    private final NotifyRegistry registry;
    private final ApplicationEventPublisher publisher;

    @Autowired
    public ArrivalNotifier(JdbcTemplate jdbc, NotifyRegistry registry, ApplicationEventPublisher publisher) {
        this.jdbc = jdbc;
        this.registry = registry;
        this.publisher = publisher;
    }

    public void publish(Event e) {
        publisher.publishEvent(e);
    }

    @Async("notifyExecutor")
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void onArrival(Event e) {
        String eventId = UUID.randomUUID().toString().replace("-", "");
        String type = e.msgType() == null || e.msgType().isBlank() ? "ARRIVAL" : e.msgType().toUpperCase();

        jdbc.update("INSERT INTO NOTIFY_QUEUE " +
                        "(EVENT_ID, ROOM_CD, MSG_TYPE, PATIENT_NO, PATIENT_NM, DOCTOR_NM, MEMO) " +
                        "VALUES (?, ?, ?, ?, ?, ?, ?)",
                eventId, e.roomCd(), type,
                e.patientNo(), e.patientNm(), e.doctorNm(), e.memo());

        Notice.Payload p = new Notice.Payload(
                eventId, e.roomCd(), type,
                e.patientNo(), e.patientNm(), e.doctorNm(), e.memo(),
                OffsetDateTime.now(), null);

        int pushed = registry.push(e.roomCd(), p);
        if (pushed > 0) {
            jdbc.update("UPDATE NOTIFY_QUEUE SET DELIVERED_AT = SYSTIMESTAMP " +
                    "WHERE EVENT_ID = ? AND DELIVERED_AT IS NULL", eventId);
        }
    }
}
