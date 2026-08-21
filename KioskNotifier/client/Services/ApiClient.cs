using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Net.Http.Json;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using KioskNotifier.Models;

namespace KioskNotifier.Services;

public sealed class ApiClient
{
    private readonly HttpClient _http;
    private readonly string _base;

    public ApiClient(string baseUrl)
    {
        _base = baseUrl.TrimEnd('/');
        _http = new HttpClient { Timeout = TimeSpan.FromSeconds(10) };
    }

    public string BaseUrl => _base;

    public async Task<RoomConfig?> ResolveRoomAsync(string pcId, string hostname, string ip, CancellationToken ct)
    {
        var url = $"{_base}/api/notify/room?pcId={Uri.EscapeDataString(pcId)}&hostname={Uri.EscapeDataString(hostname)}&ip={Uri.EscapeDataString(ip)}";
        var resp = await _http.GetAsync(url, ct);
        if ((int)resp.StatusCode == 404) return null;
        resp.EnsureSuccessStatusCode();
        return await resp.Content.ReadFromJsonAsync<RoomConfig>(cancellationToken: ct);
    }

    public async Task SaveRoomAsync(RoomConfig cfg, CancellationToken ct)
    {
        var resp = await _http.PostAsJsonAsync($"{_base}/api/notify/room", cfg, ct);
        resp.EnsureSuccessStatusCode();
    }

    public async Task<List<Notice>> PendingAsync(string roomCd, int lookbackMinutes, CancellationToken ct)
    {
        var url = $"{_base}/api/notify/pending?room={Uri.EscapeDataString(roomCd)}&minutes={lookbackMinutes}";
        try
        {
            var list = await _http.GetFromJsonAsync<List<Notice>>(url, ct);
            return list ?? new List<Notice>();
        }
        catch { return new List<Notice>(); }
    }

    public async Task AckAsync(string eventId, CancellationToken ct)
    {
        try
        {
            await _http.PostAsync($"{_base}/api/notify/ack?eventId={Uri.EscapeDataString(eventId)}", null, ct);
        }
        catch { }
    }

    public async Task ReadAsync(string eventId, CancellationToken ct)
    {
        try
        {
            await _http.PostAsync($"{_base}/api/notify/{Uri.EscapeDataString(eventId)}/read", null, ct);
        }
        catch { }
    }
}
