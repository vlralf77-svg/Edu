using System;
using System.Threading;
using System.Windows;
using KioskNotifier.Models;
using KioskNotifier.Services;

namespace KioskNotifier.Views;

public partial class SettingsWindow : Window
{
    private readonly ApiClient _api;
    private readonly string _pcId;
    private readonly string _hostname;
    private readonly string _ip;

    public RoomConfig? Result { get; private set; }

    public SettingsWindow(ApiClient api, string pcId, string hostname, string ip, RoomConfig? existing, bool autoStart)
    {
        InitializeComponent();
        _api = api;
        _pcId = pcId;
        _hostname = hostname;
        _ip = ip;

        PcIdBox.Text = pcId;
        HostBox.Text = hostname;
        IpBox.Text = ip;

        if (existing is not null)
        {
            RoomCdBox.Text = existing.RoomCd;
            RoomNmBox.Text = existing.RoomNm ?? "";
            DoctorBox.Text = existing.DoctorNm ?? "";
            SoundChk.IsChecked = string.Equals(existing.SoundYn, "Y", StringComparison.OrdinalIgnoreCase);
        }
        else
        {
            SoundChk.IsChecked = true;
        }

        AutoStartChk.IsChecked = autoStart;
    }

    private void CancelBtn_Click(object sender, RoutedEventArgs e)
    {
        DialogResult = false;
        Close();
    }

    private async void SaveBtn_Click(object sender, RoutedEventArgs e)
    {
        var roomCd = RoomCdBox.Text?.Trim() ?? "";
        if (string.IsNullOrEmpty(roomCd))
        {
            MessageBox.Show(this, "진료실 코드를 입력하세요.", "확인", MessageBoxButton.OK, MessageBoxImage.Warning);
            return;
        }

        var cfg = new RoomConfig
        {
            PcId = _pcId,
            Hostname = _hostname,
            IpAddress = _ip,
            RoomCd = roomCd,
            RoomNm = RoomNmBox.Text?.Trim(),
            DoctorNm = DoctorBox.Text?.Trim(),
            SoundYn = SoundChk.IsChecked == true ? "Y" : "N"
        };

        SaveBtn.IsEnabled = false;
        try
        {
            using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(8));
            await _api.SaveRoomAsync(cfg, cts.Token);
            LocalStore.SaveRoom(cfg);
            LocalStore.SetAutoStart(AutoStartChk.IsChecked == true);
            Result = cfg;
            DialogResult = true;
            Close();
        }
        catch (Exception ex)
        {
            LocalStore.SaveRoom(cfg);
            LocalStore.SetAutoStart(AutoStartChk.IsChecked == true);
            var r = MessageBox.Show(this,
                "서버에 저장하지 못했습니다. 로컬에만 저장하고 계속할까요?\n\n" + ex.Message,
                "네트워크 오류", MessageBoxButton.YesNo, MessageBoxImage.Warning);
            if (r == MessageBoxResult.Yes)
            {
                Result = cfg;
                DialogResult = true;
                Close();
            }
        }
        finally
        {
            SaveBtn.IsEnabled = true;
        }
    }
}
