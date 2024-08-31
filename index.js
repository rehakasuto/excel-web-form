const express = require('express');
const multer = require('multer');
const xlsx = require('xlsx');
const path = require('path');

const app = express();
const upload = multer();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(express.static('public'));

let pricesData = {};

function loadPricesData() {
    try {
        const workbook = xlsx.readFile('prices.xlsx');
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const data = xlsx.utils.sheet_to_json(sheet);
        pricesData = data.reduce((acc, row) => {
            acc[row['AKMILL quality code']] = row['€'].toString();
            return acc;
        }, {});
    } catch (error) {
        console.error('Error loading prices data:', error);
    }
}

app.post('/search', upload.none(), (req, res) => {
    const { code } = req.body; // Destructure 'code' from 'req.body'
    if (!code) {
        return res.status(400).json({ error: 'Code is required' });
    }
    const workbook = xlsx.readFile('data.xlsx'); 
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(sheet);

    loadPricesData();
    const results = data.filter(row => 
        row['AKMILL QUALITY CODE'] && row['AKMILL QUALITY CODE'].toString().includes(code)
    )
    .map(row => ({
        'AKMILL QUALITY CODE': row['AKMILL QUALITY CODE'] || '', 
        'QUALITY NAME': row['QUALITY NAME'] || '', 
        'COMPOSITION': row['COMPOSITION'] || '', 
        'PRICE': pricesData[row['AKMILL QUALITY CODE']] || 'N/A' 
    }));
    res.json(results);
});

app.get('/autocomplete', (req, res) => {
    try {
        const workbook = xlsx.readFile('data.xlsx');
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const data = xlsx.utils.sheet_to_json(sheet);

        const codes = data
        .map(row => (row['AKMILL QUALITY CODE'] || '').toString().trim())
        .filter(code => code !== '');
        res.json(codes);
    } catch (error) {
        console.error('Error processing the file:', error);
        res.status(500).send('Internal Server Error');
    }
});


app.post('/update', (req, res) => {
    const { 'AKMILL QUALITY CODE': code, 'QUALITY NAME': name, 'COMPOSITION': composition } = req.body;
    
    if (code === undefined) {
        return res.status(400).send('Invalid data');
    }

    try {
        const workbook = xlsx.readFile('data.xlsx');
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const data = xlsx.utils.sheet_to_json(sheet);

        if (!Array.isArray(data)) {
            throw new Error('Data is not an array');
        }

        const rowIndex = data.findIndex(row => row['AKMILL QUALITY CODE'] == code);
        const updatedData = data.map(row => ({
            'AKMILL QUALITY CODE': row['AKMILL QUALITY CODE'] ? row['AKMILL QUALITY CODE'].toString() : '',
            'QUALITY NAME': row['QUALITY NAME'] || '', 
            'COMPOSITION': row['COMPOSITION'] || ''
        }));

        console.log(updatedData[rowIndex]);

        if (rowIndex !== -1) {
            updatedData[rowIndex] = { 'AKMILL QUALITY CODE': code, 'QUALITY NAME': name, 'COMPOSITION': composition };
            console.log(updatedData[rowIndex]);
            const newSheet = xlsx.utils.json_to_sheet(updatedData);
  
            workbook.Sheets[sheetName] = newSheet;
            if (Array.isArray(data) && data.length > 0) {
                console.log("Data looks good, proceeding to write the file.");
                xlsx.writeFile(workbook, 'data.xlsx');
            } else {
                console.error("Data structure is invalid, not writing to the file.");
            }
            const price = pricesData[code] || 'N/A';
            return res.status(200).json({ price });
        } else {
            return res.status(404).send('Code not found');
        }
    } catch (error) {
        console.error('Error processing the file:', error);
        return res.status(500).send('Internal Server Error');
    }
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(3000, () => {
    console.log('Server is running on port 3000');
});