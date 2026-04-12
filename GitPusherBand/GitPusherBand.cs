using System;
using System.Diagnostics;
using System.Drawing;
using System.Runtime.InteropServices;
using System.Security;
using Microsoft.Win32;

namespace GitPusherBand
{
    // Electron-side changes required (described only, not implemented in this C# project):
    // 1) Start an Express HTTP server bound to localhost:43210 in Electron main process.
    // 2) Add POST /push route accepting { repoPath, featureName, apiKey } and run the same
    //    generate-commit + git push flow currently used by the in-app push action.
    // 3) Add a file watcher for %APPDATA%\GitPusher\projects.json so Electron keeps project
    //    state synchronized when the desk band updates activeProjectId.
    [ComVisible(true)]
    [Guid(ClassId)]
    [ProgId(ProgIdValue)]
    [ClassInterface(ClassInterfaceType.None)]
    public sealed class GitPusherBand : IDeskBand2, IDeskBand, IDockingWindow, IOleWindow, IObjectWithSite, IPersist, IPersistStream
    {
        public const string ProgIdValue = "GitPusherBand.TaskbarBand";
        public const string ClassId = "A47D7A2A-1F8D-4C79-8DD9-4D9724E4C8F0";

        private const string BandTitle = "GitPusherBand";
        private const string DeskBandCategory = "{00021492-0000-0000-C000-000000000046}";
        private const int MinimumBandWidth = 420;
        private const int IdealBandWidth = 420;

        private object _site;
        private BandControl _bandControl;
        private bool _compositionEnabled;
        private bool _visible = true;

        [ComRegisterFunction]
        public static void Register(Type type)
        {
            var clsid = type.GUID.ToString("B").ToUpperInvariant();

            using (Registry.ClassesRoot.CreateSubKey($@"CLSID\{clsid}\Implemented Categories\{DeskBandCategory}"))
            {
            }

            TrySetToolbarValue(Registry.CurrentUser, @"Software\Microsoft\Internet Explorer\Toolbar", clsid);
            TrySetToolbarValue(Registry.CurrentUser, @"Software\Microsoft\Internet Explorer\Toolbar\ShellBrowser", clsid);
            TrySetToolbarValue(Registry.LocalMachine, @"Software\Microsoft\Internet Explorer\Toolbar", clsid);
            TrySetToolbarValue(Registry.LocalMachine, @"Software\Microsoft\Internet Explorer\Toolbar\ShellBrowser", clsid);
        }

        [ComUnregisterFunction]
        public static void Unregister(Type type)
        {
            var clsid = type.GUID.ToString("B").ToUpperInvariant();

            Registry.ClassesRoot.DeleteSubKeyTree($@"CLSID\{clsid}\Implemented Categories\{DeskBandCategory}", false);

            TryDeleteToolbarValue(Registry.CurrentUser, @"Software\Microsoft\Internet Explorer\Toolbar", clsid);
            TryDeleteToolbarValue(Registry.CurrentUser, @"Software\Microsoft\Internet Explorer\Toolbar\ShellBrowser", clsid);
            TryDeleteToolbarValue(Registry.LocalMachine, @"Software\Microsoft\Internet Explorer\Toolbar", clsid);
            TryDeleteToolbarValue(Registry.LocalMachine, @"Software\Microsoft\Internet Explorer\Toolbar\ShellBrowser", clsid);
        }

        public int GetWindow(out IntPtr phwnd)
        {
            if (_bandControl == null || _bandControl.IsDisposed)
            {
                phwnd = IntPtr.Zero;
                return HResult.S_OK;
            }

            phwnd = _bandControl.Handle;
            return HResult.S_OK;
        }

        public int ContextSensitiveHelp(bool fEnterMode)
        {
            return HResult.E_NOTIMPL;
        }

        public int ShowDW(bool fShow)
        {
            _visible = fShow;

            if (_bandControl != null && !_bandControl.IsDisposed)
            {
                NativeMethods.ShowWindow(_bandControl.Handle, fShow ? NativeMethods.SW_SHOW : NativeMethods.SW_HIDE);
            }

            return HResult.S_OK;
        }

        public int CloseDW(uint dwReserved)
        {
            DisposeBandControl();
            return HResult.S_OK;
        }

        public int ResizeBorderDW(ref RECT prcBorder, IntPtr punkToolbarSite, bool fReserved)
        {
            return HResult.E_NOTIMPL;
        }

        public int GetBandInfo(uint dwBandID, uint dwViewMode, ref DESKBANDINFO pdbi)
        {
            if ((pdbi.dwMask & (uint)DBIM.MINSIZE) != 0)
            {
                pdbi.ptMinSize.x = MinimumBandWidth;
                pdbi.ptMinSize.y = 0;
            }

            if ((pdbi.dwMask & (uint)DBIM.ACTUAL) != 0)
            {
                pdbi.ptActual.x = IdealBandWidth;
                pdbi.ptActual.y = 0;
            }

            if ((pdbi.dwMask & (uint)DBIM.MAXSIZE) != 0)
            {
                pdbi.ptMaxSize.x = 0;
                pdbi.ptMaxSize.y = 0;
            }

            if ((pdbi.dwMask & (uint)DBIM.INTEGRAL) != 0)
            {
                pdbi.ptIntegral.x = 1;
                pdbi.ptIntegral.y = 1;
            }

            if ((pdbi.dwMask & (uint)DBIM.TITLE) != 0)
            {
                pdbi.wszTitle = BandTitle;
            }

            if ((pdbi.dwMask & (uint)DBIM.MODEFLAGS) != 0)
            {
                pdbi.dwModeFlags = DBIMF.VARIABLEHEIGHT | DBIMF.NOGRIPPER | DBIMF.NOMARGINS;
            }

            if ((pdbi.dwMask & (uint)DBIM.BKGNDCOLOR) != 0)
            {
                pdbi.crBkgnd = ColorTranslator.ToWin32(Color.FromArgb(0x1a, 0x1a, 0x1a));
            }

            return HResult.S_OK;
        }

        public int CanRenderComposited(out bool pfCanRenderComposited)
        {
            pfCanRenderComposited = true;
            return HResult.S_OK;
        }

        public int SetCompositionState(bool fCompositionEnabled)
        {
            _compositionEnabled = fCompositionEnabled;
            return HResult.S_OK;
        }

        public int GetCompositionState(out bool pfCompositionEnabled)
        {
            pfCompositionEnabled = _compositionEnabled;
            return HResult.S_OK;
        }

        public int SetSite(object pUnkSite)
        {
            _site = pUnkSite;

            if (pUnkSite == null)
            {
                DisposeBandControl();
                return HResult.S_OK;
            }

            if (!(pUnkSite is IOleWindow oleWindow))
            {
                return HResult.E_FAIL;
            }

            var getWindowResult = oleWindow.GetWindow(out var parentHandle);
            if (getWindowResult != HResult.S_OK || parentHandle == IntPtr.Zero)
            {
                return HResult.E_FAIL;
            }

            EnsureBandControl();
            NativeMethods.SetParent(_bandControl.Handle, parentHandle);
            NativeMethods.ShowWindow(_bandControl.Handle, _visible ? NativeMethods.SW_SHOW : NativeMethods.SW_HIDE);

            return HResult.S_OK;
        }

        public int GetSite(ref Guid riid, out IntPtr ppvSite)
        {
            ppvSite = IntPtr.Zero;
            if (_site == null)
            {
                return HResult.E_FAIL;
            }

            var unknownPointer = Marshal.GetIUnknownForObject(_site);
            try
            {
                return Marshal.QueryInterface(unknownPointer, ref riid, out ppvSite);
            }
            finally
            {
                Marshal.Release(unknownPointer);
            }
        }

        public int GetClassID(out Guid pClassID)
        {
            pClassID = new Guid(ClassId);
            return HResult.S_OK;
        }

        public int IsDirty()
        {
            return HResult.S_FALSE;
        }

        public int Load(System.Runtime.InteropServices.ComTypes.IStream pStm)
        {
            return HResult.S_OK;
        }

        public int Save(System.Runtime.InteropServices.ComTypes.IStream pStm, bool fClearDirty)
        {
            return HResult.S_OK;
        }

        public int GetSizeMax(out long pcbSize)
        {
            pcbSize = 0;
            return HResult.S_OK;
        }

        private void EnsureBandControl()
        {
            if (_bandControl != null && !_bandControl.IsDisposed)
            {
                return;
            }

            _bandControl = new BandControl();
            _bandControl.CreateControl();
        }

        private void DisposeBandControl()
        {
            if (_bandControl == null)
            {
                return;
            }

            if (!_bandControl.IsDisposed)
            {
                _bandControl.Dispose();
            }

            _bandControl = null;
        }

        private static void TrySetToolbarValue(RegistryKey root, string subKeyPath, string clsid)
        {
            try
            {
                using (var key = root.CreateSubKey(subKeyPath))
                {
                    key?.SetValue(clsid, BandTitle, RegistryValueKind.String);
                }
            }
            catch (UnauthorizedAccessException)
            {
                Debug.WriteLine($"GitPusherBand: no registry permission for {root.Name}\\{subKeyPath}");
            }
            catch (SecurityException)
            {
                Debug.WriteLine($"GitPusherBand: security policy blocked registry write to {root.Name}\\{subKeyPath}");
            }
        }

        private static void TryDeleteToolbarValue(RegistryKey root, string subKeyPath, string clsid)
        {
            try
            {
                using (var key = root.CreateSubKey(subKeyPath))
                {
                    key?.DeleteValue(clsid, false);
                }
            }
            catch (UnauthorizedAccessException)
            {
                Debug.WriteLine($"GitPusherBand: no registry permission for {root.Name}\\{subKeyPath}");
            }
            catch (SecurityException)
            {
                Debug.WriteLine($"GitPusherBand: security policy blocked registry delete in {root.Name}\\{subKeyPath}");
            }
        }
    }
}
