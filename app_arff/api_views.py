from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser
from rest_framework import status
from django.core.cache import cache
import pandas as pd
import hashlib
import io
import re
import numpy as np

class ARFFUploadAPI(APIView):
   
    parser_classes = [MultiPartParser]
    
    def post(self, request):
        print(" DEBUG - Request recibido")
        
        arff_file = request.FILES.get('file')
        
        if not arff_file:
            return Response(
                {'error': 'No se envió archivo'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            # Leer contenido del archivo
            file_content = arff_file.read().decode('utf-8')
            
            # Crear hash único del archivo
            file_hash = hashlib.md5(file_content.encode()).hexdigest()
            cache_key = f'arff_full_{file_hash}'
            
            # Verificar si ya está en caché
            cached_data = cache.get(cache_key)
            
            if cached_data is None:
                print(" DEBUG - Procesando archivo (no en caché)...")
                
                # Parsear el archivo ARFF para extraer metadata
                metadata = self.parse_arff_metadata(file_content)
                
                # Procesar los datos con manejo robusto de errores
                data_start = file_content.find('@data')
                if data_start == -1:
                    # Si no es ARFF válido, intentar como CSV puro
                    csv_content = file_content
                    column_names = None
                else:
                    # Tomar solo la parte después de @data
                    csv_content = file_content[data_start + 5:].strip()
                    column_names = metadata.get('attributes')
                
                from io import StringIO
                
                # Intentar leer con diferentes configuraciones
                df = self.robust_read_csv(csv_content, column_names)
                
                # Si no se pudo leer con nombres de columnas ARFF, usar genéricos
                if df is None:
                    print("⚠️ DEBUG - No se pudo leer con nombres ARFF, intentando con nombres genéricos...")
                    df = self.robust_read_csv(csv_content, None)
                
                if df is None:
                    return Response(
                        {'error': 'No se pudo procesar el archivo. Formato de datos incompatible.'}, 
                        status=status.HTTP_400_BAD_REQUEST
                    )
                
                # Limpiar valores NaN
                df = self.clean_dataframe(df)
                
                # Guardar en caché
                cached_data = {
                    'df': df,
                    'metadata': metadata
                }
                cache.set(cache_key, cached_data, 3600)
                print(f" DEBUG - DataFrame guardado en caché: {len(df)} filas")
            else:
                df = cached_data['df']
                metadata = cached_data['metadata']
                print(f" DEBUG - DataFrame recuperado de caché: {len(df)} filas")
            
            # Convertir a diccionario limpiando valores NaN
            data_dict = self.dataframe_to_dict(df.head(1000))
            
            # Retornar metadata + solo primeras 1000 filas
            response_data = {
                'success': True,
                'filename': arff_file.name,
                'columns': list(df.columns),
                'data': data_dict,
                'shape': {
                    'rows': len(df),
                    'columns': len(df.columns)
                },
                'description': metadata.get('description', 'Dataset procesado'),
                'relation': metadata.get('relation', 'N/A'),
                'cache_key': file_hash,
                'has_more': len(df) > 1000
            }
            
            print(f" DEBUG - Enviando respuesta: {len(df)} filas totales, {len(response_data['data'])} en respuesta inicial")
            return Response(response_data)
            
        except Exception as e:
            print(f" DEBUG - Error: {str(e)}")
            import traceback
            traceback.print_exc()
            
            return Response(
                {'error': f'Error procesando archivo: {str(e)}'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
    
    def robust_read_csv(self, csv_content, column_names):
        """Lee CSV de manera robusta, manejando diferentes formatos"""
        from io import StringIO
     
        configs = [
            # Configuración 1: CSV estándar
            {'sep': ',', 'quotechar': '"', 'escapechar': '\\'},
            # Configuración 2: Manejar comillas
            {'sep': ',', 'quoting': 1, 'quotechar': '"'},  
            # Configuración 3: Separador tab
            {'sep': '\t', 'quotechar': '"'},
            # Configuración 4: Sin comillas
            {'sep': ',', 'quoting': 3, 'quotechar': '"'},  
        ]
        
        for i, config in enumerate(configs):
            try:
                print(f" DEBUG - Intentando configuración {i+1}: {config}")
                
                if column_names and len(column_names) > 0:
                   
                    df = pd.read_csv(
                        StringIO(csv_content),
                        header=None,
                        **config,
                        engine='python',  
                        on_bad_lines='skip' 
                    )
                    
                    # Asignar nombres de columnas si coinciden
                    if len(column_names) == len(df.columns):
                        df.columns = column_names
                        print(f" DEBUG - Configuración {i+1} exitosa con {len(df.columns)} columnas")
                    else:
                        print(f" DEBUG - Configuración {i+1}: columnas no coinciden ({len(column_names)} vs {len(df.columns)})")
                        # Usar nombres genéricos
                        df.columns = [f'column_{j+1}' for j in range(len(df.columns))]
                else:
                    # Leer sin nombres de columnas
                    df = pd.read_csv(
                        StringIO(csv_content),
                        header=None,
                        **config,
                        engine='python',
                        on_bad_lines='skip'
                    )
                    df.columns = [f'column_{j+1}' for j in range(len(df.columns))]
                    print(f"DEBUG - Configuración {i+1} exitosa con {len(df.columns)} columnas genéricas")
                
                
                if len(df) > 0:
                    return df
                    
            except Exception as e:
                print(f"DEBUG - Configuración {i+1} falló: {str(e)}")
                continue
        
       
        return self.manual_csv_parse(csv_content, column_names)
    
    def manual_csv_parse(self, csv_content, column_names):
        """Método manual para parsear CSV problemático"""
        try:
            print(" DEBUG - Intentando parseo manual...")
            
            lines = csv_content.strip().split('\n')
            data = []
            
            for line_num, line in enumerate(lines):
                line = line.strip()
                if not line or line.startswith('%'):  
                    continue
                
                if '"' in line:
                   
                    fields = []
                    in_quotes = False
                    current_field = ""
                    
                    for char in line:
                        if char == '"':
                            in_quotes = not in_quotes
                        elif char == ',' and not in_quotes:
                            fields.append(current_field.strip())
                            current_field = ""
                        else:
                            current_field += char
                    
                    fields.append(current_field.strip())  
                else:
                   
                    fields = line.split(',')
                
                # Limpiar campos
                fields = [field.strip().strip('"') for field in fields]
                data.append(fields)
            
            if not data:
                return None
            
            # Crear DataFrame
            max_cols = max(len(row) for row in data)
            
            # Rellenar filas con menos columnas
            for row in data:
                while len(row) < max_cols:
                    row.append('')
            
            df = pd.DataFrame(data)
            
            # Asignar nombres de columnas
            if column_names and len(column_names) == len(df.columns):
                df.columns = column_names
            else:
                df.columns = [f'column_{i+1}' for i in range(len(df.columns))]
            
            print(f"DEBUG - Parseo manual exitoso: {len(df)} filas, {len(df.columns)} columnas")
            return df
            
        except Exception as e:
            print(f"DEBUG - Parseo manual falló: {str(e)}")
            return None
    
    def parse_arff_metadata(self, file_content):
        """Extrae metadata del archivo ARFF (nombres de columnas, relación, etc.)"""
        metadata = {
            'relation': 'N/A',
            'attributes': [],
            'description': 'Dataset ARFF'
        }
        
        try:
            lines = file_content.split('\n')
            
            for line in lines:
                line = line.strip()
                
                # Ignorar comentarios y líneas vacías
                if not line or line.startswith('%'):
                    continue
                
                # Extraer @relation
                if line.lower().startswith('@relation'):
                    relation_match = re.search(r'@relation\s+(.+)', line, re.IGNORECASE)
                    if relation_match:
                        metadata['relation'] = relation_match.group(1).strip().strip("'\"")
                
                # Extraer @attribute (nombres de columnas)
                elif line.lower().startswith('@attribute'):
                    # Mejorar regex para capturar nombres entre comillas
                    attr_match = re.search(r'@attribute\s+[\'"]?([^\'"{}\s]+)[\'"]?\s+', line, re.IGNORECASE)
                    if not attr_match:
                        # Intentar con comillas
                        attr_match = re.search(r'@attribute\s+[\'"]([^\'"]+)[\'"]\s+', line, re.IGNORECASE)
                    
                    if attr_match:
                        attr_name = attr_match.group(1).strip()
                        metadata['attributes'].append(attr_name)
                    else:
                        print(f"⚠️ DEBUG - No se pudo extraer atributo de: {line}")
                
                # Detener cuando encontramos @data
                elif line.lower().startswith('@data'):
                    break
            
            print(f" DEBUG - Metadata extraída:")
            print(f"   Relación: {metadata['relation']}")
            print(f"   Atributos encontrados: {len(metadata['attributes'])}")
            if metadata['attributes']:
                print(f"   Primeros 5: {metadata['attributes'][:5]}")
            
        except Exception as e:
            print(f"⚠️ DEBUG - Error parseando metadata: {str(e)}")
        
        return metadata
    
    def clean_dataframe(self, df):
        """Limpia valores NaN del DataFrame"""
        # Reemplazar NaN con None (que se convierte a null en JSON)
        df_cleaned = df.replace({np.nan: None})
        
        # También manejar otros tipos de valores no finitos
        df_cleaned = df_cleaned.replace({np.inf: None, -np.inf: None})
        
        return df_cleaned
    
    def dataframe_to_dict(self, df):
        """Convierte DataFrame a diccionario manejando valores NaN"""
        # Usar orient='records' y luego limpiar cualquier NaN residual
        data = df.to_dict('records')
        
        # Limpiar cualquier valor NaN que pueda haber quedado
        for row in data:
            for key, value in row.items():
                if pd.isna(value):
                    row[key] = None
        
        return data


class ARFFDataAPI(APIView):
    """Endpoint para obtener datos paginados"""
    
    def get(self, request):
        cache_key_hash = request.GET.get('cache_key')
        page = int(request.GET.get('page', 1))
        page_size = int(request.GET.get('page_size', 1000))
        search = request.GET.get('search', '').lower()
        
        if not cache_key_hash:
            return Response(
                {'error': 'cache_key requerido'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        cache_key = f'arff_full_{cache_key_hash}'
        cached_data = cache.get(cache_key)
        
        if cached_data is None:
            return Response(
                {'error': 'Datos no encontrados. Por favor sube el archivo nuevamente.'}, 
                status=status.HTTP_404_NOT_FOUND
            )
        
        df = cached_data['df']
        
        # Aplicar búsqueda si existe
        if search:
            mask = df.astype(str).apply(lambda x: x.str.contains(search, case=False)).any(axis=1)
            filtered_df = df[mask]
        else:
            filtered_df = df
        
        # Calcular paginación
        total_rows = len(filtered_df)
        start_idx = (page - 1) * page_size
        end_idx = start_idx + page_size
        
        page_data = filtered_df.iloc[start_idx:end_idx]
        
        # Limpiar datos para JSON
        data_dict = self.dataframe_to_dict(page_data)
        
        response_data = {
            'success': True,
            'data': data_dict,
            'page': page,
            'page_size': page_size,
            'total_rows': total_rows,
            'total_pages': (total_rows + page_size - 1) // page_size,
            'has_next': end_idx < total_rows,
            'has_previous': page > 1
        }
        
        print(f" DEBUG - Página {page}: enviando filas {start_idx}-{end_idx} de {total_rows}")
        return Response(response_data)
    
    def dataframe_to_dict(self, df):
        """Convierte DataFrame a diccionario manejando valores NaN"""
        # Usar orient='records' y luego limpiar cualquier NaN residual
        data = df.to_dict('records')
        
        # Limpiar cualquier valor NaN que pueda haber quedado
        for row in data:
            for key, value in row.items():
                if pd.isna(value):
                    row[key] = None
        
        return data