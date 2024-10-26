const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const app = express();
const jwt = require('jsonwebtoken');
require ('dotenv').config();
const PORT = process.env.PORT || 5000;
// Middleware
app.use(cors());
app.use(bodyParser.json());

// Arreglo simulado para almacenar votantes
let votantes = [];

// Función para generar un token JWT
const generarToken = (usuario) => {
    return jwt.sign({ id: usuario.numeroColegiado, email: usuario.email }, process.env.CLAVE, {
        expiresIn: process.env.TIEMPO,
    });
};

// Middleware para verificar el token JWT en rutas protegidas
const verificarToken = (req, res, next) => {
    const token = req.headers['authorization'];  // El JWT debe estar en los headers

    if (!token) {
        return res.status(403).json({ error: 'No se proporcionó un token.' });
    }

    jwt.verify(token, process.env.CLAVE, (err, decoded) => {
        if (err) {
            return res.status(401).json({ error: 'Token inválido o expirado.' });
        }

        req.usuario = decoded;  // Guardamos los datos decodificados del usuario
        next();  // Continuamos con la petición
    });
};

// Función de validación para DPI
const validarDPI = (dpi) => /^[0-9]{13}$/.test(dpi);

// Función de validación para número de colegiado
const validarNumeroColegiado = (numero) => /^[0-9]{5,10}$/.test(numero);

// Función de validación para fecha de nacimiento (mayor de edad)
const validarFechaNacimiento = (fecha) => {
    const hoy = new Date();
    const fechaNacimiento = new Date(fecha);
    const edad = hoy.getFullYear() - fechaNacimiento.getFullYear();
    return edad >= 18;
};

// Función de validación para contraseñas seguras (mínimo 8 caracteres, una mayúscula, una minúscula, un número)
const validarContrasena = (contrasena) => /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d]{8,}$/.test(contrasena);

// Ruta para registrar votantes
app.post('/register', (req, res) => {
    const { numeroColegiado, nombre, email, dpi, fechaNacimiento, contrasena } = req.body;

    // Validar que el DPI y el email no estén ya registrados
    const existeVotante = votantes.find(votante => votante.email === email || votante.dpi === dpi);
    if (existeVotante) {
        return res.status(400).json({ error: 'El DPI o email ya están registrados.' });
    }

    // Validar DPI, número de colegiado, fecha de nacimiento y contraseña
    if (!validarDPI(dpi)) {
        return res.status(400).json({ error: 'DPI inválido.' });
    }
    if (!validarNumeroColegiado(numeroColegiado)) {
        return res.status(400).json({ error: 'Número de colegiado inválido.' });
    }
    if (!validarFechaNacimiento(fechaNacimiento)) {
        return res.status(400).json({ error: 'Debe ser mayor de edad.' });
    }
    if (!validarContrasena(contrasena)) {
        return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres, incluyendo una mayúscula, una minúscula y un número.' });
    }

    // Crear nuevo votante
    const nuevoVotante = { numeroColegiado, nombre, email, dpi, fechaNacimiento, contrasena };
    votantes.push(nuevoVotante);
    console.log("Votante registrado:", nuevoVotante);
    res.status(201).json(nuevoVotante);
});

// Ruta para iniciar sesión
app.post('/login', (req, res) => {
    const { numeroColegiado, dpi, fechaNacimiento, contrasena } = req.body;

    console.log("Datos de inicio de sesión recibidos:", req.body);

    const votante = votantes.find(votante => 
        votante.numeroColegiado === numeroColegiado &&
        votante.dpi === dpi &&
        votante.fechaNacimiento === fechaNacimiento &&
        votante.contrasena === contrasena
    );

    if (!votante) {
        console.log("Credenciales incorrectas. No se encontró un votante con esos datos.");
        return res.status(400).json({ error: 'Credenciales incorrectas.' });
    }

    console.log("Inicio de sesión exitoso:", votante);
    const token = generarToken(votante);  // Generar el JWT

    res.json({ mensaje: 'Inicio de sesión exitoso', votante });
});


// Ruta para obtener todos los candidatos disponibles
app.get('/admin/candidatos', (req, res) => {
    res.json(candidatosDisponibles);
});

// Simulamos un arreglo para almacenar las campañas
let campañas = [];

// Ruta para crear una nueva campaña
app.post('/admin/campanias', (req, res) => {
    const { titulo, descripcion, estado } = req.body;

    const nuevaCampaña = {
        id: campañas.length + 1,
        titulo,
        descripcion,
        estado, // 'habilitada' o 'deshabilitada'
        candidatos: []
    };

    campañas.push(nuevaCampaña);
    res.status(201).json(nuevaCampaña);
});

// Ruta para eliminar una campaña
app.delete('/admin/campanias/:id', (req, res) => {
    const { id } = req.params;
    const index = campañas.findIndex(c => c.id === parseInt(id));
    
    if (index !== -1) {
        campañas.splice(index, 1); // Eliminar la campaña
        return res.json({ mensaje: 'Campaña eliminada' });
    }
    
    return res.status(404).json({ error: 'Campaña no encontrada' });
});

// Ruta para obtener todas las campañas
app.get('/admin/campanias', (req, res) => {
    res.json(campañas);
});

// Ruta para actualizar el estado de una campaña
app.put('/admin/campanias/:id/estado', (req, res) => {
    const { id } = req.params;
    const { estado } = req.body;

    const campaña = campañas.find(c => c.id === parseInt(id));
    if (!campaña) {
        return res.status(404).json({ error: 'Campaña no encontrada' });
    }

    campaña.estado = estado;
    res.json(campaña);
});

app.post('/admin/campanias/:id/candidatos', (req, res) => {
    try {
        const { id } = req.params;
        const { candidatos } = req.body;

        // Validar que los candidatos sean un arreglo
        if (!Array.isArray(candidatos)) {
            return res.status(400).json({ error: 'Candidatos debe ser un arreglo.' });
        }

        const campaña = campañas.find(c => c.id === parseInt(id));
        if (!campaña) {
            return res.status(404).json({ error: 'Campaña no encontrada' });
        }

        // Añadir el campo "votos" a cada candidato si no existe
        const candidatosConVotos = candidatos.map(candidato => ({
            ...candidato,
            votos: candidato.votos || 0
        }));

        // Reemplazar la lista de candidatos existentes en la campaña
        campaña.candidatos = candidatosConVotos;

        res.json(campaña);
    } catch (error) {
        console.error('Error al asignar candidatos:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});



// Ruta para eliminar un candidato de una campaña
app.delete('/admin/campanias/:campaniaId/candidatos/:candidatoId', (req, res) => {
    const { campaniaId, candidatoId } = req.params;
    const campania = campañas.find(c => c.id === parseInt(campaniaId));

    if (!campania) {
        return res.status(404).json({ error: 'Campaña no encontrada' });
    }

    const candidatoIndex = campania.candidatos.findIndex(c => c.id === parseInt(candidatoId));
    if (candidatoIndex === -1) {
        return res.status(404).json({ error: 'Candidato no encontrado' });
    }

    campania.candidatos.splice(candidatoIndex, 1); // Eliminar el candidato
    res.json(campania);
});


// Ruta para obtener los detalles de una campaña por ID
app.get('/admin/campanias/:id', (req, res) => {
    const { id } = req.params;
    const campaña = campañas.find(c => c.id === parseInt(id));

    if (!campaña) {
        return res.status(404).json({ error: 'Campaña no encontrada' });
    }

    res.json(campaña);
});

// Ruta para registrar un voto
app.post('/votantes/campanias/:id/votar', (req, res) => {
    console.log('Recibiendo solicitud de voto');
    
    const { id } = req.params;
    const { candidatoId } = req.body;

    // Aquí agregamos los console.log para revisar los valores
    console.log("ID campaña:", id);
    console.log("ID candidato:", candidatoId);

    if (!candidatoId) {
        return res.status(400).json({ error: 'Debe seleccionar un candidato' });
    }

    const campaña = campañas.find(c => c.id === parseInt(id));
    if (!campaña) {
        return res.status(404).json({ error: 'Campaña no encontrada' });
    }

    const candidato = campaña.candidatos.find(c => c.id === parseInt(candidatoId));
    if (!candidato) {
        return res.status(404).json({ error: 'Candidato no encontrado' });
    }

    candidato.votos += 1; // Incrementar los votos del candidato
    res.json({ mensaje: 'Voto registrado', candidato });
});




// Ruta para cerrar la votación de una campaña y mostrar resultados
app.put('/admin/campanias/:id/cerrar', (req, res) => {
    const { id } = req.params;

    const campaña = campañas.find(c => c.id === parseInt(id));
    if (!campaña) {
        return res.status(404).json({ error: 'Campaña no encontrada' });
    }

    // Cambiamos el estado de la campaña a 'cerrada'
    campaña.estado = 'cerrada';

    // Devolvemos los resultados de la votación (cantidad de votos por candidato)
    const resultados = campaña.candidatos.map(c => ({
        nombre: c.nombre,
        votos: c.votos
    }));

    res.json({ mensaje: 'Votación cerrada', resultados });
});

// Iniciar el servidor
app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
