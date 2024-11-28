import axios from 'axios'; //Axios
import { StatusBar } from 'expo-status-bar';
import React, { useState, useRef, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Image, Alert } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as MediaLibrary from 'expo-media-library';
import Slider from '@react-native-community/slider';
import Button from '../../components/Button';
import * as ImageManipulator from 'expo-image-manipulator';
import Svg, { Polygon } from 'react-native-svg';
import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import ImageResizer from 'react-native-image-resizer';


  //detalles
  //1. Se pide permiso para acceder a la galería
  //2. Se toma la foto y se guarda en la variable image
  //3. Se llama a la función savePicture para guardar la imagen en la galería
  //4. Se llama a la función getLastSavedImage para obtener la última imagen guardada en la galería y se asigna a la variable previousImage
export default function App() {

  const [cameraPermissions, requestCameraPermisision] = useCameraPermissions();
  const [mediaLibraryPermissionResponse, requestMediaLibraryPermission] = MediaLibrary.usePermissions();
  const [cameraProps, setCameraProps] = useState({
    zoom: 0,
    facing: 'back',
    flash: 'on',
    enableTorch: false
  });

  const [image, setImage] = useState(null);
  const [previousImage, setPreviousImage] = useState(null);

  const cameraRef = useRef(null);
  
  const [successMessage, setSuccessMessage] = useState(null); //mensaje de exito
  const [mitilidosCount, setMitilidosCount] = useState(null); //Total de mitilidos
  const [largo_minimo_mm, setLargoMinimoMM] = useState(null) //Largo minimo MM mitilidos
  const [largo_maximo_mm, setLargoMaximoMM] = useState(null) //Largo maximo MM mitilidos
  const [largo_promedio_mm, setLargoPromedioMM] = useState(null) //Largo Promedio MM mitilidos
  const [largo_moda_mm, setLargoModaMM] = useState(null) //Largo moda MM mitilidos
  const [confianza_promedio, setConfianzaPromedio] = useState(null) //Confianza promedio
  const [segmentaciones, SetSegmentaciones] = useState([]) //Segmentaciones

  const [imageWidth, setImageWidth] = useState(0);
  const [imageHeight, setImageHeight] = useState(0);

  const [originalDimensions, setOriginalDimensions] = useState({width:0, height:0});



  //Para cargar la última imagen guardada cuando cambia el permiso
  useEffect(() => {
    if(cameraPermissions && cameraPermissions.granted && mediaLibraryPermissionResponse && mediaLibraryPermissionResponse.status === 'granted') {
      getLastSavedImage();
    }
  }, [cameraPermissions, mediaLibraryPermissionResponse])

  if(!cameraPermissions || !mediaLibraryPermissionResponse) {
    //Para mostrar que los permisos aún se están cargando 
    return <View/>
  }

  if(!cameraPermissions.granted || mediaLibraryPermissionResponse.status !== 'granted') {
    //Cuando no se conceden permisos
    return (
      <View style={styles.container} >
        <Text>Permissions not granted</Text>
        <TouchableOpacity style={styles.button} onPress={() => {
          requestCameraPermisision();
          requestMediaLibraryPermission();
        }} >
          <Text style={styles.buttonText} >Grant Permission</Text>
        </TouchableOpacity>
      </View>
    )
  }

  //Funcion para renderizar usando las segmentaciones *JSON*
  const renderSegmentaciones = () => {
    if (!segmentaciones || segmentaciones.length === 0) return null;
  
    const apiWidth = 640; // Ancho utilizado por la API para la inferencia
    const apiHeight = 640; // Altura utilizada por la API para la inferencia
  
    return segmentaciones.map((segmento, index) => (
      <Polygon
        key={index}
        points={segmento
          .map(point => {
            const scaledX = (point[0] / apiWidth) * originalDimensions.width; // Escalar en X
            const scaledY = (point[1] / apiHeight) * originalDimensions.height; // Escalar en Y
            const adjustedX = (scaledX / originalDimensions.width) * imageWidth; // Ajustar para pantalla
            const adjustedY = (scaledY / originalDimensions.height) * imageHeight; // Ajustar para pantalla
            return `${adjustedX},${adjustedY}`;
          })
          .join(' ')} // Ajustar las coordenadas proporcionalmente
        fill="rgba(0, 255, 0, 0.3)" // Color de relleno con opacidad
        stroke="green" // Color del borde
        strokeWidth="2" // Grosor del borde
      />
    ));
  };

  //Funcion para alternar las propiedades de la cámara
  const toggleProperty =  ( prop, option1, option2) => {
    setCameraProps((current) =>({
      ...current,
      [prop]: current[prop] === option1 ? option2 : option1
    }));
  };

  //Funcion para hacer zoom
  const zoomIn = () => {
    setCameraProps((current) => ({
      ...current,
      zoom: Math.min(current.zoom + 0.1, 1)
    }))
  }

  //Función para alejar
  const zoomOut = () => {
    setCameraProps((current) => ({
      ...current,
      zoom: Math.max(current.zoom - 0.1, 0)
    }))
  }

  //Funcion para capturar la imagen

  const takePicture = async () => {
    if (cameraRef.current) {
      try {
        const picture = await cameraRef.current.takePictureAsync();
  
        setImage(picture.uri); // Mostrar la imagen en la vista
        setOriginalDimensions({width: picture.width, height: picture.height}) //Guardar dimensiones generales

        await handleImageProcessing(picture.uri/*manipulatedImage.uri*/); // Enviar directamente al endpoint
        /*setImage(null); //Limpiar estado de la imagen despues de procesarla *  */
      } catch (err) {
        console.log('Error while taking the picture: ', err);
      }
    }
  };


  const handleImageProcessing = async (imageUri) => {
    try {
      if (!imageUri) {
        console.error('Error: La imagen es nula o no existe');
        return;
      }

      setSuccessMessage(null); // Limpiar mensajes previos
      setMitilidosCount(null);
      SetSegmentaciones(null) //Limpiar segmentaciones previas

      const resizedImage = await ImageManipulator.manipulateAsync(
        imageUri,
        [{ resize: { width: 1024, height: 1024 } }],
        { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
      );
  
      setOriginalDimensions({width: 1024, height: 1024}); //Guardar dimensiones redimensionadas

      const formData = new FormData();
      formData.append('file', {
        uri: Platform.OS === 'ios' ? resizedImage.uri.replace('file://', '') : resizedImage.uri,
        name: 'imagen.jpg',
        type: 'image/jpeg',
      });
  
      // Enviar la imagen redimensionada a la API
      const apiResponse = await axios.post('https://apimitilidos.onrender.com/process_image/', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
  
      if (apiResponse.status === 200) {
        console.log('Imagen procesada correctamente:', apiResponse.data);
        setSuccessMessage('Imagen procesada correctamente');
  
        setTimeout(async () => {
          const result = await getResult();
          if (result) {
            setMitilidosCount(result.total_mitilidos);
            setLargoMinimoMM(result.largo_minimo_mm);
            setLargoMaximoMM(result.largo_maximo_mm);
            setLargoPromedioMM(result.largo_promedio_mm);
            setLargoModaMM(result.largo_moda_mm);
            setConfianzaPromedio(result.confianza_promedio);
            SetSegmentaciones(result.segmentaciones);
          }
        }, 20000); // Aumentar tiempo de espera si es necesario
      }
    } catch (error) {
      console.error('Error al procesar la imagen:', error);
    }
  };

  /*
  const handleImageProcessing = async (imageUri) => {
    try {
      if (!imageUri) {
        console.error('Error: La imagen es nula o no existe');
        return;
      }
  
      setSuccessMessage(null); // Limpiar mensajes previos
      setMitilidosCount(null);
      SetSegmentaciones(null) //Limpiar segmentaciones previas
  
      const formData = new FormData();
      formData.append('file', {
        uri: Platform.OS === 'ios' ? imageUri.replace('file://', '') : imageUri,
        name: 'imagen.jpg',
        type: 'image/jpeg',
      });
  
      const apiResponse = await axios.post('https://apimitilidos.onrender.com/process_image/', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
  
      if (apiResponse.status === 200) {
        console.log('Imagen procesada correctamente:', apiResponse.data);
        setSuccessMessage('Imagen procesada correctamente');
  
        // Esperar y obtener resultados
        setTimeout(async () => {
          const result = await getResult();
          if (result) {
            if (result.total_mitilidos !== undefined) {
              setMitilidosCount(result.total_mitilidos);
            }
            if (result.largo_minimo_mm !== undefined) {
              setLargoMinimoMM(result.largo_minimo_mm);
            }
            if (result.largo_maximo_mm !== undefined) {
              setLargoMaximoMM(result.largo_maximo_mm);
            }
            if (result.largo_promedio_mm !== undefined) {
              setLargoPromedioMM(result.largo_promedio_mm);
            }
            if (result.largo_moda_mm !== undefined) {
              setLargoModaMM(result.largo_moda_mm);
            }
            if (result.confianza_promedio !== undefined) {
              setConfianzaPromedio(result.confianza_promedio);
            }
            if (result.segmentaciones !== undefined) {
              SetSegmentaciones(result.segmentaciones);
            }
          }
        }, 13000);
      }
    } catch (error) {
      console.error('Error al procesar la imagen:', error);
    }
  };*/
  
  //Funcion para obtener los resultados del endpoint de la API
  const getResult = async () => {
    try {
      const response = await axios.get('https://apimitilidos.onrender.com/get_results/');
      console.log('Resultados de la inferencia:', response.data);
      return response.data; // Retorna los datos 
    } catch (error) {
      console.error('Error al obtener los resultados:', error);
      return null;
    }
  };
   
  //Función para guardar la imagen usando MediaLibrary (se espera agregar y modificar formas para enviar a una base de datos)
  const savePicture = async() => {
    if(image) {
      try {
        const asset = await MediaLibrary.createAssetAsync(image);
        const assetInfo = await MediaLibrary.getAssetInfoAsync(asset.id);
        setImage(null);
        Alert.alert('Photo saved!', image);
        setImage(null);
        getLastSavedImage();
      } catch (err) {
        console.log('Error while saving the picture: ', err);
      }
    }
  }


  //Función para obtener la última imagen guardada del álbum DCIM creado en la galería por expo (funcion probablemente temporal / testeo)
  const getLastSavedImage = async() => {
    if (mediaLibraryPermissionResponse && mediaLibraryPermissionResponse.status === 'granted') {
      const dcimAlbum = await MediaLibrary.getAlbumAsync('DCIM');

      if(dcimAlbum) {
        const {assets} = await MediaLibrary.getAssetsAsync({
          album: dcimAlbum,
          sortBy: [[MediaLibrary.SortBy.creationTime, false]],
          mediaType: MediaLibrary.MediaType.photo,
          first: 1
        });

        if (assets.length > 0) {
          const assetInfo = await MediaLibrary.getAssetInfoAsync(assets[0].id)
          setPreviousImage(assetInfo.localUri || assetInfo.uri);
        } else {
          setPreviousImage(null);
        }
      } else {
        setPreviousImage(null);
      }
    }
  }
  

  return (
    <View style = {styles.container}>
      {!image ?(
        <>
          <View style={styles.topControlsContainer} >
            <Button
              icon={cameraProps.flash === 'on' ? 'flash-on': 'flash-off'}
              onPress={() => toggleProperty('flash', 'on', 'off') }
            
            />
    
            <Button
              icon={cameraProps.enableTorch ? 'flashlight-on': 'flashlight-off'}
              onPress={() => toggleProperty('enableTorch', true, false)}
            />
  
          </View>
          <CameraView 
            style={styles.camera}
            zoom={cameraProps.zoom}
            flash={cameraProps.flash}
            enableTorch={cameraProps.enableTorch}
            ref={cameraRef}
          />
          <View style={styles.sliderContainer} > 
            <Button
              icon='zoom-out'
              onPress={zoomOut}
            />
            <Slider
              style={styles.slider}
              minimumValue={0}
              maximumValue={1}
              value={cameraProps.zoom}
              onValueChange={(value) => setCameraProps((current) => ({...current, zoom:value}))}
              step={0.1}
            />
            <Button
              icon='zoom-in'
              onPress={zoomIn}
            />
          </View> 
    
          <View style={styles.bottomControlsContainer} >
            <TouchableOpacity onPress={() => previousImage && setImage(previousImage)} >
              <Image
                source={{uri:previousImage}}
                style={styles.previousImage}
              />
            </TouchableOpacity>

            <Button
              icon='camera'
              size={60}
              style={{height:60}}
              onPress={takePicture}
            />
          </View>
        </>  
      ): (
        <>
          <Image
            source={{uri:image}}
            style={styles.camera}
            onLayout={(event) => {
              const {width, height} = event.nativeEvent.layout;
              setImageWidth(width);
              setImageHeight(height);
            }}/>

          {<Svg height={imageHeight} width={imageWidth} style={styles.overlay} >
            {renderSegmentaciones()}
          </Svg>}

          <View style={styles.infoContainer}>
            {successMessage && <Text style={styles.succesMessage}> {successMessage} </Text>}
            {mitilidosCount && largo_minimo_mm && largo_maximo_mm && largo_promedio_mm 
            && largo_moda_mm && (
              <Text style={styles.mitilidosCount}>
                Total de mitilidos: {mitilidosCount} {"\n"}
                Largo minimo MM: {largo_minimo_mm.toFixed(2)} {"\n"}
                Largo maximo MM: {largo_maximo_mm.toFixed(2)} {"\n"}
                Largo promedio MM: {largo_promedio_mm.toFixed(2)} {"\n"}
                Largo moda MM: {largo_moda_mm.toFixed(2)} {"\n"}
              </Text>
            )}
          </View>

          <View style={styles.bottomControlsContainer} >
            <Button
              icon='flip-camera-android'
              onPress={() => setImage(null)}
            />
            <Button
              icon='check'
              onPress={savePicture}
            />
          </View>
        </>
      )}
    </View>
  );
}

//Estilos para cada vista, boton o contenedor correspondiente
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    marginTop: 30
  },
  topControlsContainer: {
    height: 100,
    backgroundColor: 'gray',
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center'
  },
  button: {
    backgroundColor: 'blue',
    padding: 10,
    margin: 10,
    borderRadius: 5,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
  },
  camera: {
    flex: 1,
    width: '100%'
  },
  slider: {
    flex: 1,
    marginHorizontal:10,
  },
  sliderContainer: {
    position:'absolute',
    bottom: 120,
    left: 20,
    right: 20,
    flexDirection: 'row'
  },
  bottomControlsContainer: {
    height: 100,
    backgroundColor: 'gray',
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center'
  },
  previousImage: {
    width: 60,
    height: 60,
    borderRadius: 50
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  //Detalles bajo imagen
  infoContainer: {
    marginTop: 0,
    alignItems: 'center',
  },
  succesMessage: {
    color: 'green',
    textAlign: 'center',
    marginBottom: 0,
  },
  mitilidosCount: {
    fontSize: 12,
    color: 'black',
    textAlign: 'center',
  }
});
