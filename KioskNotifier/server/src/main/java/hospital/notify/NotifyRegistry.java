package hospital.notify;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;

import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class NotifyRegistry {

    private final ObjectMapper mapper;
    private final ConcurrentHashMap<String, Set<WebSocketSession>> byRoom = new ConcurrentHashMap<>();

    @Autowired
    public NotifyRegistry(ObjectMapper mapper) {
        this.mapper = mapper;
    }

    public void register(String roomCd, WebSocketSession session) {
        byRoom.computeIfAbsent(roomCd, k -> ConcurrentHashMap.newKeySet()).add(session);
    }

    public void unregister(String roomCd, WebSocketSession session) {
        var set = byRoom.get(roomCd);
        if (set != null) set.remove(session);
    }

    public int push(String roomCd, Notice.Payload payload) {
        var set = byRoom.get(roomCd);
        if (set == null || set.isEmpty()) return 0;

        int delivered = 0;
        String json;
        try {
            json = mapper.writeValueAsString(payload);
        } catch (Exception e) {
            return 0;
        }

        for (WebSocketSession s : set) {
            if (!s.isOpen()) continue;
            try {
                synchronized (s) {
                    s.sendMessage(new TextMessage(json));
                }
                delivered++;
            } catch (Exception ignored) {}
        }
        return delivered;
    }

    public boolean hasSubscribers(String roomCd) {
        var set = byRoom.get(roomCd);
        return set != null && !set.isEmpty();
    }
}
