using System;
using System.IO;
using System.Linq;
using System.Net;
using System.Net.NetworkInformation;
using System.Net.Sockets;
using System.Text.Json;
using KioskNotifier.Models;
using Microsoft.Win32;

namespace KioskNotifier.Services;

public static class LocalStore
{
    private static readonly string DataDir =
        Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "KioskNotifier");
    private static readonly string PcIdPath   = Path.Combine(DataDir, "pcid");
    private static readonly string RoomPath   = Path.Combine(DataDir, "room.json");
    private static readonly string SettingsPath = Path.Combine(DataDir, "appsettings.json");
    private static readonly string LogDir     = Path.Combine(DataDir, "logs");
    private const string RunKey = @"Software\Microsoft\Windows\CurrentVersion\Run";
    private const string RunValueName = "KioskNotifier";

    static LocalStore()
    {
        Directory.CreateDirectory(DataDir);
        Directory.CreateDirectory(LogDir);
    }

    public static string GetOrCreatePcId()
    {
        try
        {
            if (File.Exists(PcIdPath))
            {
                var v = File.ReadAllText(PcIdPath).Trim();
                if (!string.IsNullOrWhiteSpace(v)) return v;
            }
        }
        catch { }
        var id = Guid.NewGuid().ToString("N");
        try { File.WriteAllText(PcIdPath, id); } catch { }
        return id;
    }

    public static string Hostname => Environment.MachineName;

    public static string PrimaryIpv4()
    {
        try
        {
            foreach (var ni in NetworkInterface.GetAllNetworkInterfaces()
                .Where(n => n.OperationalStatus == OperationalStatus.Up &&
                            n.NetworkInterfaceType != NetworkInterfaceType.Loopback &&
                            n.NetworkInterfaceType != NetworkInterfaceType.Tunnel))
            {
                var props = ni.GetIPProperties();
                if (props.GatewayAddresses.Count == 0) continue;
                foreach (var ua in props.UnicastAddresses)
                {
                    if (ua.Address.AddressFamily == AddressFamily.InterNetwork &&
                        !IPAddress.IsLoopback(ua.Address))
                    {
                        return ua.Address.ToString();
                    }
                }
            }
        }
        catch { }
        return "0.0.0.0";
    }

    public static RoomConfig? LoadRoom()
    {
        try
        {
            if (!File.Exists(RoomPath)) return null;
            var json = File.ReadAllText(RoomPath);
            return JsonSerializer.Deserialize<RoomConfig>(json);
        }
        catch { return null; }
    }

    public static void SaveRoom(RoomConfig cfg)
    {
        var json = JsonSerializer.Serialize(cfg, new JsonSerializerOptions { WriteIndented = true });
        File.WriteAllText(RoomPath, json);
    }

    public static AppSettings LoadSettings(string? overridePath = null)
    {
        string? path = null;
        if (!string.IsNullOrEmpty(overridePath) && File.Exists(overridePath))
            path = overridePath;
        else if (File.Exists(SettingsPath))
            path = SettingsPath;
        else
        {
            var side = Path.Combine(AppContext.BaseDirectory, "appsettings.json");
            if (File.Exists(side)) path = side;
        }

        if (path is null) return new AppSettings();
        try
        {
            var opts = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
            return JsonSerializer.Deserialize<AppSettings>(File.ReadAllText(path), opts) ?? new AppSettings();
        }
        catch { return new AppSettings(); }
    }

    public static void SaveSettings(AppSettings s)
    {
        var json = JsonSerializer.Serialize(s, new JsonSerializerOptions { WriteIndented = true });
        File.WriteAllText(SettingsPath, json);
    }

    public static void SetAutoStart(bool enabled)
    {
        try
        {
            using var key = Registry.CurrentUser.OpenSubKey(RunKey, writable: true)
                            ?? Registry.CurrentUser.CreateSubKey(RunKey);
            if (key is null) return;

            if (enabled)
            {
                var exe = Environment.ProcessPath ?? "";
                if (!string.IsNullOrEmpty(exe))
                    key.SetValue(RunValueName, "\"" + exe + "\"");
            }
            else
            {
                if (key.GetValue(RunValueName) is not null)
                    key.DeleteValue(RunValueName, false);
            }
        }
        catch { }
    }

    private static readonly object _logLock = new();
    public static void Log(string msg)
    {
        try
        {
            var line = $"{DateTime.Now:yyyy-MM-dd HH:mm:ss.fff} {msg}{Environment.NewLine}";
            var f = Path.Combine(LogDir, $"kiosk-{DateTime.Now:yyyyMMdd}.log");
            lock (_logLock) File.AppendAllText(f, line);
        }
        catch { }
    }
}
