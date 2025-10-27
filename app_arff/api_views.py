from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser
from rest_framework import status
import pandas as pd
import io

class ARFFUploadAPI(APIView):
    parser_classes = [MultiPartParser]
    
    def post(self, request):
        print("🔍 DEBUG - Request recibido")
        print("🔍 DEBUG - FILES:", request.FILES)
        
        arff_file = request.FILES.get('file')
        print("🔍 DEBUG - Archivo obtenido:", arff_file)
        
        if not arff_file:
            return Response(
                {'error': 'No se envió archivo'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            print("✅ DEBUG - Procesando archivo como en Jupyter notebook...")
            
            # Leer el archivo como texto (como lo haces en el notebook)
            file_content = arff_file.read().decode('utf-8')
            
            # DEBUG: Mostrar primeras líneas
            lines = file_content.split('\n')[:10]
            print("🔍 DEBUG - Primeras 10 líneas:")
            for i, line in enumerate(lines):
                print(f"   Línea {i+1}: {line}")
            
            # Procesar como CSV (los archivos NSL-KDD son básicamente CSV con header ARFF)
            # Buscar donde empiezan los datos (@data)
            data_start = file_content.find('@data')
            if data_start == -1:
                # Si no encuentra @data, procesar todo como CSV
                csv_content = file_content
            else:
                # Tomar solo la parte después de @data
                csv_content = file_content[data_start + 5:].strip()
            
            # Leer como CSV con pandas
            from io import StringIO
            df = pd.read_csv(StringIO(csv_content), header=None)
            
            # Si el archivo tiene muchas columnas, asignar nombres genéricos
            if len(df.columns) > 10:  # Asumir que es NSL-KDD
                # Nombres de columnas basados en el dataset NSL-KDD
                column_names = [
                    'duration', 'protocol_type', 'service', 'flag', 'src_bytes', 
                    'dst_bytes', 'land', 'wrong_fragment', 'urgent', 'hot', 
                    'num_failed_logins', 'logged_in', 'num_compromised', 'root_shell', 
                    'su_attempted', 'num_root', 'num_file_creations', 'num_shells', 
                    'num_access_files', 'num_outbound_cmds', 'is_host_login', 
                    'is_guest_login', 'count', 'srv_count', 'serror_rate', 
                    'srv_serror_rate', 'rerror_rate', 'srv_rerror_rate', 
                    'same_srv_rate', 'diff_srv_rate', 'srv_diff_host_rate', 
                    'dst_host_count', 'dst_host_srv_count', 'dst_host_same_srv_rate', 
                    'dst_host_diff_srv_rate', 'dst_host_same_src_port_rate', 
                    'dst_host_srv_diff_host_rate', 'dst_host_serror_rate', 
                    'dst_host_srv_serror_rate', 'dst_host_rerror_rate', 
                    'dst_host_srv_rerror_rate', 'label', 'difficulty'
                ]
                
                # Asignar nombres según el número de columnas
                if len(df.columns) <= len(column_names):
                    df.columns = column_names[:len(df.columns)]
                else:
                    df.columns = [f'col_{i}' for i in range(len(df.columns))]
            
            response_data = {
                'success': True,
                'filename': arff_file.name,
                'columns': list(df.columns),
                'data': df.head(100).to_dict('records'),
                'shape': {
                    'rows': len(df),
                    'columns': len(df.columns)
                },
                'description': 'Procesado como CSV (formato NSL-KDD)',
                'relation': 'KDD Dataset'
            }
            
            print(f"✅ DEBUG - Procesamiento exitoso: {len(df)} filas, {len(df.columns)} columnas")
            return Response(response_data)
            
        except Exception as e:
            print(f"❌ DEBUG - Error procesando: {str(e)}")
            import traceback
            print("❌ DEBUG - Traceback completo:")
            traceback.print_exc()
            
            return Response(
                {'error': f'Error procesando archivo: {str(e)}'}, 
                status=status.HTTP_400_BAD_REQUEST
            )