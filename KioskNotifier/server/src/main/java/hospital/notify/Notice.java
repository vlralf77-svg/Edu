package hospital.notify;

import java.time.OffsetDateTime;

public final class Notice {

    public record Payload(
            String eventId,
            String roomCd,
            String msgType,
            String patientNo,
            String patientNm,
            String doctorNm,
            String memo,
            OffsetDateTime createdAt,
            String soundYn
    ) {}

    public record RoomConfig(
            String pcId,
            String hostname,
            String ipAddress,
            String roomCd,
            String roomNm,
            String doctorNm,
            String soundYn
    ) {}

    public record RoomConfigRequest(
            String pcId,
            String hostname,
            String ipAddress,
            String roomCd,
            String roomNm,
            String doctorNm,
            String soundYn
    ) {}

    private Notice() {}
}
