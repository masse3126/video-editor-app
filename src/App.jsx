import { useState, useRef } from 'react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import './App.css';

function App() {
  const [videoFile, setVideoFile] = useState(null);
  const [videoUrl, setVideoUrl] = useState('');
  const [status, setStatus] = useState('Pilih video untuk memulai');
  const [audioScale, setAudioScale] = useState('0');
  const [deviceModel, setDeviceModel] = useState('iPhone 15 Pro Max');
  const [location, setLocation] = useState({ lat: -0.7893, lng: 113.9213 }); // Default Indonesia
  
  // State untuk Metadata Asli Video yang di-upload
  const [originalMeta, setOriginalMeta] = useState(null);
  const [resultDownloadUrl, setResultDownloadUrl] = useState('');
  const [resultFileName, setResultFileName] = useState('');
  
  const ffmpegRef = useRef(new FFmpeg());

  // Handle saat video dipilih & cek metadata dasar
  const handleVideoSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setVideoFile(file);
    setVideoUrl(URL.createObjectURL(file));
    setResultDownloadUrl(''); // Reset hasil sebelumnya

    // Ambil info metadata dasar dari file yang di-upload
    const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
    setOriginalMeta({
      name: file.name,
      size: `${sizeMB} MB`,
      type: file.type || 'video/mp4',
      lastModified: new Date(file.lastModified).toLocaleString()
    });
  };

  // Komponen Peta Interaktif
  const LocationPicker = () => {
    useMapEvents({
      click(e) {
        setLocation({ lat: e.latlng.lat, lng: e.latlng.lng });
      },
    });
    return location ? <Marker position={[location.lat, location.lng]} /> : null;
  };

  const processVideo = async () => {
    if (!videoFile) return alert('Pilih video dulu!');
    setStatus('Memuat mesin pemroses (FFmpeg)...');
    
    const ffmpeg = ffmpegRef.current;
    if (!ffmpeg.loaded) {
      await ffmpeg.load();
    }

    setStatus('Memproses video... (Tunggu sebentar)');
    const inputName = 'input.mp4';
    const outputName = 'output.mp4';

    await ffmpeg.writeFile(inputName, await fetchFile(videoFile));

    // Menentukan efek audio berdasarkan skala 1-4
    let audioFilter = '';
    if (audioScale === '1') audioFilter = 'chorus=0.5:0.9:50|60:0.4|0.32:0.25|0.4:2|2.3';
    if (audioScale === '2') audioFilter = 'vibrato=f=7.0:d=0.5,volume=1.5';
    if (audioScale === '3') audioFilter = 'acrusher=level_in=8:level_out=18:bits=8:mode=log,volume=2.0';
    if (audioScale === '4') audioFilter = 'aecho=0.8:0.88:60:0.4,acrusher=level_in=8:level_out=18:bits=4:mode=log,volume=3.0';

    const command = [
      '-i', inputName,
      '-metadata', `creation_time=now`,
      '-metadata', `location=${location.lat}${location.lng > 0 ? '+' : ''}${location.lng}`,
      '-metadata', `model="${deviceModel}"`,
      '-metadata', `make="${deviceModel.split(' ')[0]}"`,
    ];

    if (audioScale !== '0') {
      command.push('-af', audioFilter);
    }

    command.push(outputName);

    await ffmpeg.exec(command);

    setStatus('Pemrosesan Selesai!');
    
    const data = await ffmpeg.readFile(outputName);
    const url = URL.createObjectURL(new Blob([data.buffer], { type: 'video/mp4' }));
    
    const date = new Date();
    const finalFileName = `Videos_${date.getDate()}_${date.getMonth() + 1}_${date.getFullYear()}_${date.getHours()}${date.getMinutes()}.mp4`;

    setResultDownloadUrl(url);
    setResultFileName(finalFileName);
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif', maxWidth: '600px', margin: 'auto', paddingBottom: '50px' }}>
      <h2>🛠️ Metadata Video Editor Pro</h2>
      
      {/* 1. UPLOAD VIDEO */}
      <div style={{ marginBottom: '15px', background: '#f9f9f9', padding: '10px', borderRadius: '8px' }}>
        <label><b>1. Pilih / Upload Video:</b></label><br/>
        <input type="file" accept="video/mp4,video/*" onChange={handleVideoSelect} style={{ marginTop: '5px' }} />
      </div>

      {/* 2. TOMBOL / INFO CEK METADATA ASLI (Muncul setelah video dipilih) */}
      {originalMeta && (
        <div style={{ marginBottom: '15px', background: '#eef6ff', padding: '12px', borderRadius: '8px', border: '1px solid #bthe' }}>
          <h4 style={{ margin: '0 0 8px 0', color: '#0056b3' }}>📋 Informasi Metadata Asli Video:</h4>
          <p style={{ margin: '4px 0' }}><b>Nama File:</b> {originalMeta.name}</p>
          <p style={{ margin: '4px 0' }}><b>Ukuran:</b> {originalMeta.size}</p>
          <p style={{ margin: '4px 0' }}><b>Tipe:</b> {originalMeta.type}</p>
          <p style={{ margin: '4px 0' }}><b>Terakhir Dimodifikasi:</b> {originalMeta.lastModified}</p>
        </div>
      )}

      {/* 3. PILIH TITIK DI PETA */}
      <div style={{ marginBottom: '15px' }}>
        <label><b>2. Pilih Lokasi (GPS):</b> Tap di peta untuk injeksi koordinat</label>
        <MapContainer center={[-0.7893, 113.9213]} zoom={4} style={{ height: '220px', width: '100%', marginTop: '5px', borderRadius: '10px' }}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <LocationPicker />
        </MapContainer>
        <small style={{ color: '#555' }}>Koordinat dipilih: Lat {location.lat.toFixed(4)}, Lng {location.lng.toFixed(4)}</small>
      </div>

      {/* 4. PERUSAK AUDIO */}
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

      {/* 5. GANTI NAMA PONSEL */}
      <div style={{ marginBottom: '20px' }}>
        <label><b>4. Ganti Metadata Perangkat:</b></label><br/>
        <select value={deviceModel} onChange={(e) => setDeviceModel(e.target.value)} style={{ padding: '8px', width: '100%', marginTop: '5px' }}>
          <option value="iPhone 15 Pro Max">iPhone 15 Pro Max</option>
          <option value="iPhone 14 Pro">iPhone 14 Pro</option>
          <option value="Samsung Galaxy S24 Ultra">Samsung Galaxy S24 Ultra</option>
          <option value="Xiaomi 14 Pro">Xiaomi 14 Pro</option>
        </select>
      </div>

      {/* TOMBOL PROSES UTAMA */}
      <button onClick={processVideo} style={{ padding: '15px', width: '100%', backgroundColor: '#007BFF', color: 'white', border: 'none', borderRadius: '5px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' }}>
        ⚙️ Proses Video Sekarang
      </button>

      {/* STATUS & TOMBOL DOWNLOAD / SIMPAN HASIL */}
      <div style={{ marginTop: '20px', textAlign: 'center' }}>
        <p style={{ fontWeight: 'bold', color: status.includes('Selesai') ? 'green' : '#333' }}>
          Status: {status}
        </p>

        {/* Tombol Download Muncul Otomatis Jika Sudah Selesai */}
        {resultDownloadUrl && (
          <div style={{ marginTop: '15px', padding: '15px', background: '#d4edda', borderRadius: '8px', border: '1px solid #c3e6cb' }}>
            <p style={{ color: '#155724', fontWeight: 'bold', marginBottom: '10px' }}>Video Berhasil Dimodifikasi!</p>
            <a 
              href={resultDownloadUrl} 
              download={resultFileName}
              style={{ 
                display: 'inline-block', 
                padding: '12px 25px', 
                backgroundColor: '#28a745', 
                color: 'white', 
                textDecoration: 'none', 
                borderRadius: '5px', 
                fontWeight: 'bold',
                fontSize: '16px'
              }}
            >
              📥 DOWNLOAD / SIMPAN VIDEO
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;