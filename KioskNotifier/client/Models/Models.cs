using System;
using System.Text.Json.Serialization;

namespace KioskNotifier.Models;

public sealed class Notice
{
    [JsonPropertyName("eventId")]     public string EventId { get; set; } = "";
    [JsonPropertyName("roomCd")]      public string RoomCd { get; set; } = "";
    [JsonPropertyName("msgType")]     public string MsgType { get; set; } = "ARRIVAL";
    [JsonPropertyName("patientNo")]   public string PatientNo { get; set; } = "";
    [JsonPropertyName("patientNm")]   public string PatientNm { get; set; } = "";
    [JsonPropertyName("doctorNm")]    public string? DoctorNm { get; set; }
    [JsonPropertyName("memo")]        public string? Memo { get; set; }
    [JsonPropertyName("createdAt")]   public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.Now;
    [JsonPropertyName("soundYn")]     public string? SoundYn { get; set; }
}

public sealed class RoomConfig
{
    [JsonPropertyName("pcId")]       public string PcId { get; set; } = "";
    [JsonPropertyName("hostname")]   public string? Hostname { get; set; }
    [JsonPropertyName("ipAddress")]  public string? IpAddress { get; set; }
    [JsonPropertyName("roomCd")]     public string RoomCd { get; set; } = "";
    [JsonPropertyName("roomNm")]     public string? RoomNm { get; set; }
    [JsonPropertyName("doctorNm")]   public string? DoctorNm { get; set; }
    [JsonPropertyName("soundYn")]    public string SoundYn { get; set; } = "Y";
}

public sealed class AppSettings
{
    public string ServerBaseUrl { get; set; } = "http://localhost:8080";
    public string Transport { get; set; } = "auto";
    public int PollIntervalSeconds { get; set; } = 2;
    public int SocketFailLimit { get; set; } = 3;
    public int ReconnectDelaySeconds { get; set; } = 5;
    public int PendingLookbackMinutes { get; set; } = 30;
    public int ToastDurationSeconds { get; set; } = 12;
    public int MaxVisibleToasts { get; set; } = 4;
    public bool AutoStart { get; set; } = true;
}
