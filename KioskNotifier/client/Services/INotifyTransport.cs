using System;
using System.Threading;
using System.Threading.Tasks;
using KioskNotifier.Models;

namespace KioskNotifier.Services;

public enum TransportState { Idle, Connecting, Live, Polling, Failed }

public interface INotifyTransport : IAsyncDisposable
{
    string Name { get; }
    TransportState State { get; }
    event Action<Notice>? OnNotice;
    event Action<TransportState, string?>? OnState;

    Task StartAsync(string roomCd, CancellationToken ct);
    Task StopAsync();
}
