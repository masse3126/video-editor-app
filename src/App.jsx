import { useState, useRef, useEffect } from 'react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import './App.css';

// Komponen tambahan untuk menggeser peta secara otomatis
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
  const [location, setLocation] = useState({ lat: -0.7893, lng: 113.9213 }); // Default Indonesia
  
  const [originalMetadata, setOriginalMetadata] = useState('');
  const [downloadInfo, setDownloadInfo] = useState(null);
  
  const ffmpegRef = useRef(new FFmpeg());

  const LocationPicker = () => {
    useMapEvents({
      click(e) {
        setLocation({ lat: e.latlng.lat, lng: e.latlng.lng });
      },
    });
    return location ? <Marker position={[location.lat, location.lng]} /> : null;
  };

  // FITUR BARU: Meminta Izin GPS Ponsel
  const getDeviceLocation = () => {
    if (!navigator.geolocation) {
      alert('Browser/Perangkat Anda tidak mendukung fitur GPS.');
      return;
    }

    setStatus('Meminta izin lokasi perangkat...');
    
    // Ini akan memunculkan pop-up izin aplikasi di ponsel!
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        });
        setStatus('Lokasi perangkat berhasil didapatkan!');
      },
      (error) => {
        alert('Gagal mendapatkan lokasi. Pastikan izin lokasi diaktifkan.');
        setStatus('Gagal mengakses GPS.');
      },
      { enableHighAccuracy: true } // Meminta GPS akurasi tinggi
    );
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
    const logCallback = ({ message }) => logs.push(message);

    ffmpeg.on('log', logCallback);
    await ffmpeg.exec(['-i', inputName]);
    ffmpeg.off('log', logCallback);

    const logString = logs.join('\n');
    setOriginalMetadata(logString || 'Metadata tidak ditemukan.');
    setStatus('Selesai mengekstrak metadata!');
  };

  const processVideo = async () => {
    if (!videoFile) return alert('Pilih video dulu!');
    setStatus('Memuat mesin pemroses (FFmpeg)...');
    setDownloadInfo(null);
    
    const ffmpeg = ffmpegRef.current;
    if (!ffmpeg.loaded) await ffmpeg.load();

    setStatus('Memproses video... (Ini mungkin memakan waktu, harap tunggu)');
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

    await ffmpeg.exec(command);
    setStatus('Proses selesai! Menyiapkan file unduhan...');
    
    const data = await ffmpeg.readFile(outputName);
    const url = URL.createObjectURL(new Blob([data.buffer], { type: 'video/mp4' }));
    
    const date = new Date();
    const finalFileName = `Videos_${date.getDate()}_${date.getDay()}_${date.getFullYear()}_${date.getHours()}${date.getMinutes()}.mp4`;

    setDownloadInfo({ url, filename: finalFileName });
    setStatus('Video berhasil disimpan di memori! Silakan klik tombol "Simpan / Download" di bawah.');
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
          }} 
        />
        
        <div style={{ marginTop: '15px' }}>
          <button onClick={checkMetadata} style={{ padding: '8px 12px', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>
            🔍 Cek Metadata Asli
          </button>
        </div>

        {originalMetadata && (
          <div style={{ marginTop: '10px', padding: '10px', backgroundColor: '#1e1e1e', color: '#00ff00', borderRadius: '5px', maxHeight: '200px', overflowY: 'auto', fontSize: '12px', fontFamily: 'monospace' }}>
            <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{originalMetadata}</pre>
          </div>
        )}
      </div>

      {/* 2. LOKASI DENGAN IZIN GPS */}
      <div style={{ marginBottom: '15px' }}>
        <label><b>2. Pilih Lokasi (GPS):</b></label><br/>
        
        {/* Tombol Peminta Izin */}
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

      {/* 3. AUDIO */}
      <div style={{ marginBottom: '15px' }}>
        <label><b>3. Perusak Audio:</b></label><br/>
        <select value={audioScale} onChange={(e) => setAudioScale(e.target.value)} style={{ padding: '8px', width: '100%', marginTop: '5px' }}>
          <option value="0">Original (Tidak Rusak)</option>
          <option value="1">Skala 1 (Bergema)</option>
          <option value="2">Skala 2 (Distorsi Sedang)</option>
          <option value="3">Skala 3 (Rusak Kasar / Glitch)</option>
          <option value="4">Skala 4 (Rusak Parah / Noise Telinga Berdarah)</option>
        </select>
      </div>

      {/* 4. PERANGKAT */}
      <div style={{ marginBottom: '20px' }}>
        <label><b>4. Ganti Metadata Perangkat:</b></label><br/>
        <select value={deviceModel} onChange={(e) => setDeviceModel(e.target.value)} style={{ padding: '8px', width: '100%', marginTop: '5px' }}>
          <option value="iPhone 15 Pro Max">iPhone 15 Pro Max</option>
          <option value="iPhone 14 Pro">iPhone 14 Pro</option>
          <option value="Samsung Galaxy S24 Ultra">Samsung Galaxy S24 Ultra</option>
          <option value="Xiaomi 14 Pro">Xiaomi 14 Pro</option>
        </select>
      </div>

      {/* TOMBOL PROSES */}
      <button onClick={processVideo} style={{ padding: '15px', width: '100%', backgroundColor: '#007BFF', color: 'white', border: 'none', borderRadius: '5px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' }}>
        ⚙️ Proses Video Sekarang
      </button>

      <p style={{ marginTop: '15px', fontWeight: 'bold', color: status.includes('Selesai') || status.includes('berhasil') ? 'green' : '#333' }}>
        Status: {status}
      </p>

      {/* TOMBOL DOWNLOAD */}
      {downloadInfo && (
        <a 
          href={downloadInfo.url} 
          download={downloadInfo.filename}
          style={{ display: 'block', textAlign: 'center', marginTop: '15px', padding: '15px', width: '100%', boxSizing: 'border-box', backgroundColor: '#28a745', color: 'white', textDecoration: 'none', borderRadius: '5px', fontSize: '16px', fontWeight: 'bold' }}
        >
          ⬇️ Simpan / Download Hasil Video
        </a>
      )}

    </div>
  );
}

export default App;