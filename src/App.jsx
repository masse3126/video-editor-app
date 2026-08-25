import { useState, useEffect } from 'react'; //
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet'; //[cite: 1]

// IMPORT PLUGIN CAPACITOR
import { Geolocation } from '@capacitor/geolocation'; //[cite: 1]
import { Filesystem, Directory } from '@capacitor/filesystem'; //[cite: 1]

import 'leaflet/dist/leaflet.css'; //[cite: 1]
import './App.css'; //[cite: 1]

const RecenterAutomatically = ({ lat, lng }) => { //[cite: 1]
  const map = useMap(); //[cite: 1]
  useEffect(() => { //[cite: 1]
    map.setView([lat, lng]); //[cite: 1]
  }, [lat, lng, map]); //[cite: 1]
  return null; //[cite: 1]
}

function App() { //[cite: 1]
  const [videoFile, setVideoFile] = useState(null); //[cite: 1]
  const [status, setStatus] = useState('Pilih video untuk memulai'); //[cite: 1]
  const [audioScale, setAudioScale] = useState('0'); //[cite: 1]
  const [deviceModel, setDeviceModel] = useState('Samsung Galaxy S26 Ultra'); //[cite: 1]
  const [location, setLocation] = useState({ lat: -0.7893, lng: 113.9213 }); //[cite: 1]
  
  const [progress, setProgress] = useState(0); //[cite: 1]
  const [downloadInfo, setDownloadInfo] = useState(null); //[cite: 1]

  // Otomatis minta izin saat aplikasi pertama dibuka
  useEffect(() => { //[cite: 1]
    const requestStartupPermissions = async () => { //[cite: 1]
      try { //[cite: 1]
        await Geolocation.requestPermissions(); //[cite: 1]
        await Filesystem.requestPermissions(); //[cite: 1]
      } catch (e) { //[cite: 1]
        console.log('Izin startup dilewati/ditolak:', e); //[cite: 1]
      } //[cite: 1]
    }; //[cite: 1]
    requestStartupPermissions(); //[cite: 1]
  }, []); //[cite: 1]

  const LocationPicker = () => { //[cite: 1]
    useMapEvents({ //[cite: 1]
      click(e) { //[cite: 1]
        setLocation({ lat: e.latlng.lat, lng: e.latlng.lng }); //[cite: 1]
      }, //[cite: 1]
    }); //[cite: 1]
    return location ? <Marker position={[location.lat, location.lng]} /> : null; //[cite: 1]
  }; //[cite: 1]

  const getDeviceLocation = async () => { //[cite: 1]
    try { //[cite: 1]
      setStatus('Mengambil lokasi perangkat...'); //[cite: 1]
      const position = await Geolocation.getCurrentPosition({ enableHighAccuracy: true }); //[cite: 1]
      setLocation({ //[cite: 1]
        lat: position.coords.latitude, //[cite: 1]
        lng: position.coords.longitude //[cite: 1]
      }); //[cite: 1]
      setStatus('Lokasi perangkat berhasil didapatkan!'); //[cite: 1]
    } catch (error) { //[cite: 1]
      alert('Gagal mendapatkan lokasi. Pastikan GPS aktif.'); //[cite: 1]
      setStatus('Gagal mengakses GPS.'); //[cite: 1]
    } //[cite: 1]
  }; //[cite: 1]

  const processVideoOnServer = async () => {
    if (!videoFile) return alert('Pilih video dulu!'); //[cite: 1]
    
    setStatus('Mengunggah video ke komputer...');
    setProgress(25);
    setDownloadInfo(null); //[cite: 1]

    const formData = new FormData();
    formData.append('video', videoFile);
    formData.append('audioScale', audioScale);
    formData.append('lat', location.lat);
    formData.append('lng', location.lng);
    formData.append('deviceModel', deviceModel);

    try {
      // IP Komputermu sudah dimasukkan ke sini
      const SERVER_URL = 'http://192.168.235.20:3000/process-video'; 
      
      const response = await fetch(SERVER_URL, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error("Server gagal memproses");

      setProgress(75);
      setStatus('Proses selesai! Mengunduh hasil dari komputer...');

      const blob = await response.blob();
      const date = new Date(); //[cite: 1]
      const finalFileName = `Videos_${date.getDate()}_${date.getMonth() + 1}_${date.getFullYear()}_${date.getHours()}${date.getMinutes()}.mp4`; //[cite: 1]

      setDownloadInfo({ blob, filename: finalFileName }); //[cite: 1]
      setProgress(100); //[cite: 1]
      setStatus('Berhasil! Silakan klik tombol Simpan di bawah.'); //[cite: 1]

    } catch (error) {
      console.error(error);
      setStatus('Proses Gagal! Pastikan IP benar dan Komputer menyala.');
      setProgress(0);
    }
  };

  const blobToBase64 = (blob) => { //[cite: 1]
    return new Promise((resolve, reject) => { //[cite: 1]
      const reader = new FileReader(); //[cite: 1]
      reader.onloadend = () => { //[cite: 1]
        if (typeof reader.result === 'string') { //[cite: 1]
          resolve(reader.result.split(',')[1]); //[cite: 1]
        } else { //[cite: 1]
          reject(new Error("Format data tidak valid.")); //[cite: 1]
        } //[cite: 1]
      }; //[cite: 1]
      reader.onerror = (err) => reject(err); //[cite: 1]
      reader.readAsDataURL(blob); //[cite: 1]
    }); //[cite: 1]
  }; //[cite: 1]

  const saveVideoToDevice = async () => { //[cite: 1]
    if (!downloadInfo || !downloadInfo.blob) { //[cite: 1]
      return alert('File video belum siap atau gagal diproses!'); //[cite: 1]
    } //[cite: 1]

    try { //[cite: 1]
      setStatus('Meminta izin akses penyimpanan...'); //[cite: 1]
      const permissionCheck = await Filesystem.checkPermissions(); //[cite: 1]
      if (permissionCheck.publicStorage !== 'granted') { //[cite: 1]
        const req = await Filesystem.requestPermissions(); //[cite: 1]
        if (req.publicStorage !== 'granted') { //[cite: 1]
          alert('Izin penyimpanan ditolak!'); //[cite: 1]
          setStatus('Penyimpanan dibatalkan.'); //[cite: 1]
          return; //[cite: 1]
        } //[cite: 1]
      } //[cite: 1]

      setStatus('Mengonversi file video...'); //[cite: 1]
      const base64Data = await blobToBase64(downloadInfo.blob); //[cite: 1]

      setStatus('Menyimpan file ke Penyimpanan...'); //[cite: 1]
      
      await Filesystem.writeFile({ //[cite: 1]
        path: downloadInfo.filename, //[cite: 1]
        data: base64Data, //[cite: 1]
        directory: Directory.Documents, //[cite: 1]
        recursive: true //[cite: 1]
      }); //[cite: 1]

      alert(`BERHASIL! Video tersimpan di folder Documents HP Anda dengan nama: ${downloadInfo.filename}`); //[cite: 1]
      setStatus('Video berhasil disimpan ke HP!'); //[cite: 1]

    } catch (error) { //[cite: 1]
      console.error(error); //[cite: 1]
      alert('GAGAL MENYIMPAN: ' + error.message); //[cite: 1]
      setStatus('Gagal menyimpan file.'); //[cite: 1]
    } //[cite: 1]
  }; //[cite: 1]

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif', maxWidth: '600px', margin: 'auto' }}>
      <h2>🛠️ Metadata Video Editor (Server Mode)</h2>
      
      <div style={{ marginBottom: '15px', padding: '15px', border: '1px solid #ddd', borderRadius: '8px' }}>
        <label><b>1. Pilih Video:</b></label><br/><br/>
        <input 
          type="file" 
          accept="video/mp4" 
          onChange={(e) => { //[cite: 1]
            setVideoFile(e.target.files[0]); //[cite: 1]
            setDownloadInfo(null); //[cite: 1]
            setProgress(0); //[cite: 1]
          }} 
        />
      </div>

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
          <label><b>4. Perangkat (Model 2026):</b></label>
          <select value={deviceModel} onChange={(e) => setDeviceModel(e.target.value)} style={{ padding: '8px', width: '100%', marginTop: '5px' }}>
            <option value="Samsung Galaxy S26 Ultra">Samsung Galaxy S26 Ultra</option>
            <option value="Xiaomi 17 Ultra">Xiaomi 17 Ultra</option>
            <option value="OPPO Find X9 Pro">OPPO Find X9 Pro</option>
            <option value="Vivo V80">Vivo V80</option>
            <option value="OnePlus 15s">OnePlus 15s</option>
          </select>
        </div>
      </div>

      <button onClick={processVideoOnServer} style={{ padding: '15px', width: '100%', backgroundColor: '#007BFF', color: 'white', border: 'none', borderRadius: '5px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' }}>
        ⚙️ Kirim ke PC & Proses
      </button>

      <div style={{ marginTop: '20px', padding: '15px', border: '1px solid #ddd', borderRadius: '8px', backgroundColor: '#f8f9fa' }}>
        <h4 style={{ margin: '0 0 10px 0' }}>Progres Proses:</h4>
        
        <div style={{ width: '100%', backgroundColor: '#e9ecef', borderRadius: '5px', overflow: 'hidden', height: '20px', marginBottom: '10px' }}>
          <div style={{ height: '100%', backgroundColor: '#28a745', width: `${progress}%`, transition: 'width 0.3s' }}></div>
        </div>
        <p style={{ margin: '0 0 10px 0', fontWeight: 'bold', textAlign: 'center' }}>{progress}%</p>
        
        <p style={{ fontWeight: 'bold', color: status.includes('Gagal') ? 'red' : '#007BFF' }}>
          Status: {status}
        </p>
      </div>

      {downloadInfo && ( //[cite: 1]
        <button 
          onClick={saveVideoToDevice} //[cite: 1]
          style={{ marginTop: '15px', padding: '15px', width: '100%', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '5px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' }} //[cite: 1]
        >
          ⬇️ Simpan Video ke HP
        </button> //[cite: 1]
      )}

    </div>
  ); //[cite: 1]
} //[cite: 1]

export default App; //[cite: 1]