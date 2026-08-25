import { useState, useRef, useEffect } from 'react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';

// IMPORT PLUGIN CAPACITOR
import { Geolocation } from '@capacitor/geolocation';
import { Filesystem, Directory } from '@capacitor/filesystem';

import 'leaflet/dist/leaflet.css';
import './App.css';

// Komponen Peta Otomatis
const RecenterAutomatically = ({ lat, lng }) => {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng]);
  }, [lat, lng, map]);
  return null;
}

function App() {
  const [videoFile, setVideoFile] = useState(null);
  const [status, setStatus] = useState('Pilih video untuk memulai');
  const [audioScale, setAudioScale] = useState('0');
  const [deviceModel, setDeviceModel] = useState('iPhone 15 Pro Max');
  const [location, setLocation] = useState({ lat: -0.7893, lng: 113.9213 }); // Default
  
  // STATE BARU: Untuk Progres & Log
  const [progress, setProgress] = useState(0);
  const [processLogs, setProcessLogs] = useState([]);
  
  const [originalMetadata, setOriginalMetadata] = useState('');
  const [downloadInfo, setDownloadInfo] = useState(null);
  
  const ffmpegRef = useRef(new FFmpeg());

  // FITUR BARU: Minta Izin Otomatis Saat Aplikasi Pertama Dibuka
  useEffect(() => {
    const requestStartupPermissions = async () => {
      try {
        // Minta Izin Lokasi
        let locPerm = await Geolocation.checkPermissions();
        if (locPerm.location !== 'granted') await Geolocation.requestPermissions();
        
        // Minta Izin Penyimpanan
        let filePerm = await Filesystem.checkPermissions();
        if (filePerm.publicStorage !== 'granted') await Filesystem.requestPermissions();
      } catch (e) {
        console.log('Izin ditolak atau tidak didukung di perangkat ini.', e);
      }
    };
    requestStartupPermissions();
  }, []);

  const LocationPicker = () => {
    useMapEvents({
      click(e) {
        setLocation({ lat: e.latlng.lat, lng: e.latlng.lng });
      },
    });
    return location ? <Marker position={[location.lat, location.lng]} /> : null;
  };

  const getDeviceLocation = async () => {
    try {
      setStatus('Mengambil lokasi perangkat...');
      const position = await Geolocation.getCurrentPosition({ enableHighAccuracy: true });
      setLocation({
        lat: position.coords.latitude,
        lng: position.coords.longitude
      });
      setStatus('Lokasi perangkat berhasil didapatkan!');
    } catch (error) {
      alert('Gagal mendapatkan lokasi. Pastikan GPS aktif.');
      setStatus('Gagal mengakses GPS.');
    }
  };

  const checkMetadata = async () => {
    if (!videoFile) return alert('Pilih video dulu!');
    
    setStatus('Mengekstrak metadata...');
    setOriginalMetadata('Sedang memuat data...');
    
    const ffmpeg = ffmpegRef.current;
    if (!ffmpeg.loaded) await ffmpeg.load();

    const inputName = 'check_input.mp4';
    await ffmpeg.writeFile(inputName, await fetchFile(videoFile));

    let logs = [];
    const logCb = ({ message }) => logs.push(message);

    ffmpeg.on('log', logCb);
    await ffmpeg.exec(['-i', inputName]);
    ffmpeg.off('log', logCb);

    setOriginalMetadata(logs.join('\n') || 'Metadata tidak ditemukan.');
    setStatus('Selesai mengekstrak metadata!');
  };

  const processVideo = async () => {
    if (!videoFile) return alert('Pilih video dulu!');
    
    // Reset state progres dan log
    setProgress(0);
    setProcessLogs([]);
    setDownloadInfo(null);
    setStatus('Memuat mesin pemroses (FFmpeg)...');
    
    const ffmpeg = ffmpegRef.current;
    if (!ffmpeg.loaded) await ffmpeg.load();

    // Dengarkan Progres dan Log FFmpeg
    ffmpeg.on('progress', ({ progress }) => {
      setProgress(Math.round(progress * 100));
    });
    
    ffmpeg.on('log', ({ message }) => {
      setProcessLogs((prevLogs) => [...prevLogs, message]);
    });

    setStatus('Memproses video... Silakan pantau Terminal Log di bawah.');
    const inputName = 'input.mp4';
    const outputName = 'output.mp4';

    await ffmpeg.writeFile(inputName, await fetchFile(videoFile));

    let audioFilter = '';
    if (audioScale === '1') audioFilter = '-af "chorus=0.5:0.9:50|60:0.4|0.32:0.25|0.4:2|2.3"';
    if (audioScale === '2') audioFilter = '-af "vibrato=f=7.0:d=0.5, volume=1.5"';
    if (audioScale === '3') audioFilter = '-af "acrusher=level_in=8:level_out=18:bits=8:mode=log, volume=2.0"';
    if (audioScale === '4') audioFilter = '-af "aecho=0.8:0.88:60:0.4, acrusher=level_in=8:level_out=18:bits=4:mode=log, volume=3.0"';

    const command = [
      '-i', inputName,
      '-metadata', `creation_time=now`,
      '-metadata', `location=${location.lat}${location.lng > 0 ? '+' : ''}${location.lng}`,
      '-metadata', `location-eng=${location.lat}${location.lng > 0 ? '+' : ''}${location.lng}`,
      '-metadata', `model="${deviceModel}"`,
      '-metadata', `make="${deviceModel.split(' ')[0]}"`,
    ];

    if (audioScale !== '0') command.push('-af', audioFilter.replace('-af ', ''));
    command.push(outputName);

    try {
      await ffmpeg.exec(command);
      setStatus('Proses selesai! Menyiapkan file untuk disimpan...');
      
      const data = await ffmpeg.readFile(outputName);
      const blob = new Blob([data.buffer], { type: 'video/mp4' });
      
      const date = new Date();
      const finalFileName = `Videos_${date.getDate()}_${date.getMonth() + 1}_${date.getFullYear()}_${date.getHours()}${date.getMinutes()}.mp4`;

      setDownloadInfo({ blob, filename: finalFileName });
      setStatus('Video berhasil diproses! Silakan klik tombol Simpan ke DCIM.');
    } catch (error) {
      setProcessLogs(prev => [...prev, `ERROR FATAL: ${error.message}`]);
      setStatus('Proses Gagal! Lihat log untuk detail.');
    } finally {
      // Bersihkan pendengar event agar tidak menumpuk di proses berikutnya
      ffmpeg.off('progress');
      ffmpeg.off('log');
    }
  };

  // FUNGSI KONVERSI BLOB KE BASE64 (Dengan Try-Catch Anti-Stuck)
  const blobToBase64 = (blob) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result.split(',')[1]);
      reader.onerror = () => reject(new Error("Gagal membaca memori file (File mungkin terlalu besar untuk RAM)"));
      reader.readAsDataURL(blob);
    });
  };

  // FITUR PENYIMPANAN KE DCIM
  const saveVideoToDevice = async () => {
    if (!downloadInfo) return;
    try {
      setStatus('Mengonversi file ke format Android... (Tunggu sebentar)');
      
      // Ambil Base64 dengan aman
      const base64Data = await blobToBase64(downloadInfo.blob);

      setStatus('Menyimpan file ke folder DCIM HP...');
      
      // Simpan menggunakan Directory.ExternalStorage (Root perangkat) + Folder DCIM
      await Filesystem.writeFile({
        path: `DCIM/${downloadInfo.filename}`, // Akan masuk ke Internal Storage/DCIM/
        data: base64Data,
        directory: Directory.ExternalStorage,
      });

      alert(`Sukses! Video disimpan di Galeri / Folder DCIM dengan nama: ${downloadInfo.filename}`);
      setStatus('Video berhasil disimpan!');

    } catch (error) {
      console.error(error);
      alert('GAGAL MENYIMPAN: ' + error.message);
      setStatus('Gagal menyimpan file.');
    }
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif', maxWidth: '600px', margin: 'auto' }}>
      <h2>🛠️ Metadata Video Editor Pro</h2>
      
      {/* 1. UPLOAD VIDEO */}
      <div style={{ marginBottom: '15px', padding: '15px', border: '1px solid #ddd', borderRadius: '8px' }}>
        <label><b>1. Pilih Video:</b></label><br/><br/>
        <input 
          type="file" 
          accept="video/mp4" 
          onChange={(e) => {
            setVideoFile(e.target.files[0]);
            setOriginalMetadata('');
            setDownloadInfo(null);
            setProgress(0);
            setProcessLogs([]);
          }} 
        />
        
        <div style={{ marginTop: '15px' }}>
          <button onClick={checkMetadata} style={{ padding: '8px 12px', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>
            🔍 Cek Metadata Asli
          </button>
        </div>

        {originalMetadata && (
          <div style={{ marginTop: '10px', padding: '10px', backgroundColor: '#1e1e1e', color: '#00ff00', borderRadius: '5px', maxHeight: '150px', overflowY: 'auto', fontSize: '12px', fontFamily: 'monospace' }}>
            <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{originalMetadata}</pre>
          </div>
        )}
      </div>

      {/* 2. LOKASI */}
      <div style={{ marginBottom: '15px' }}>
        <label><b>2. Pilih Lokasi (GPS):</b></label><br/>
        <button onClick={getDeviceLocation} style={{ marginBottom: '10px', padding: '8px 12px', backgroundColor: '#17a2b8', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>
          📍 Gunakan Lokasi Ponsel Saya
        </button>

        <MapContainer center={[location.lat, location.lng]} zoom={4} style={{ height: '250px', width: '100%', marginTop: '5px', borderRadius: '10px' }}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <LocationPicker />
          <RecenterAutomatically lat={location.lat} lng={location.lng} />
        </MapContainer>
        <small>Lat: {location.lat.toFixed(6)}, Lng: {location.lng.toFixed(6)}</small>
      </div>

      {/* 3. AUDIO & PERANGKAT */}
      <div style={{ marginBottom: '15px', display: 'flex', gap: '10px' }}>
        <div style={{ flex: 1 }}>
          <label><b>3. Audio:</b></label>
          <select value={audioScale} onChange={(e) => setAudioScale(e.target.value)} style={{ padding: '8px', width: '100%', marginTop: '5px' }}>
            <option value="0">Original</option>
            <option value="1">Skala 1 (Gema)</option>
            <option value="2">Skala 2 (Distorsi)</option>
            <option value="3">Skala 3 (Glitch)</option>
            <option value="4">Skala 4 (Noise)</option>
          </select>
        </div>
        <div style={{ flex: 1 }}>
          <label><b>4. Perangkat:</b></label>
          <select value={deviceModel} onChange={(e) => setDeviceModel(e.target.value)} style={{ padding: '8px', width: '100%', marginTop: '5px' }}>
            <option value="iPhone 15 Pro Max">iPhone 15 Pro Max</option>
            <option value="iPhone 14 Pro">iPhone 14 Pro</option>
            <option value="Samsung Galaxy S24 Ultra">S24 Ultra</option>
            <option value="Xiaomi 14 Pro">Xiaomi 14 Pro</option>
          </select>
        </div>
      </div>

      {/* TOMBOL PROSES */}
      <button onClick={processVideo} style={{ padding: '15px', width: '100%', backgroundColor: '#007BFF', color: 'white', border: 'none', borderRadius: '5px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' }}>
        ⚙️ Proses Video Sekarang
      </button>

      {/* INDIKATOR PROGRES & LOG TERMINAL */}
      <div style={{ marginTop: '20px', padding: '15px', border: '1px solid #ddd', borderRadius: '8px', backgroundColor: '#f8f9fa' }}>
        <h4 style={{ margin: '0 0 10px 0' }}>Progres Proses:</h4>
        
        {/* Progress Bar */}
        <div style={{ width: '100%', backgroundColor: '#e9ecef', borderRadius: '5px', overflow: 'hidden', height: '20px', marginBottom: '10px' }}>
          <div style={{ height: '100%', backgroundColor: '#28a745', width: `${progress}%`, transition: 'width 0.3s' }}></div>
        </div>
        <p style={{ margin: '0 0 10px 0', fontWeight: 'bold', textAlign: 'center' }}>{progress}%</p>
        
        <p style={{ fontWeight: 'bold', color: status.includes('Gagal') ? 'red' : 'green' }}>
          Status: {status}
        </p>

        {/* Terminal Log */}
        <div style={{ marginTop: '10px', padding: '10px', backgroundColor: '#1e1e1e', color: '#00ff00', borderRadius: '5px', height: '150px', overflowY: 'auto', fontSize: '11px', fontFamily: 'monospace' }}>
          {processLogs.length === 0 ? (
            <span style={{ color: '#888' }}>Menunggu proses dimulai...</span>
          ) : (
            processLogs.map((log, index) => <div key={index}>{log}</div>)
          )}
        </div>
      </div>

      {/* TOMBOL PENYIMPANAN NATIVE */}
      {downloadInfo && (
        <button 
          onClick={saveVideoToDevice}
          style={{ marginTop: '15px', padding: '15px', width: '100%', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '5px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' }}
        >
          ⬇️ Simpan Video ke Folder DCIM
        </button>
      )}

    </div>
  );
}

export default App;