// multimodal-processor.js
import fs from 'fs/promises';
import path from 'path';
import { PDFExtract } from 'pdf.js-extract';
import * as XLSX from 'xlsx';
import { OpenAI } from 'openai';

class MultimodalProcessor {
    constructor(openai) {
        this.openai = openai;
        this.pdfExtract = new PDFExtract();
    }

    // 处理不同类型的文件
    async processFile(filePath) {
        const ext = path.extname(filePath).toLowerCase();
        
        switch (ext) {
            case '.txt':
                return this.processTxt(filePath);
            case '.pdf':
                return this.processPdf(filePath);
            case '.xlsx':
            case '.xls':
                return this.processExcel(filePath);
            case '.csv':
                return this.processCsv(filePath);
            case '.md':
                return this.processMarkdown(filePath);
            case '.docx':
                return this.processDocx(filePath);
            case '.json':
                return this.processJson(filePath);
            default:
                throw new Error(`不支持的文件类型: ${ext}`);
        }
    }

    // 处理文本文件
    async processTxt(filePath) {
        const content = await fs.readFile(filePath, 'utf-8');
        return [{
            type: 'text',
            content: content,
            metadata: {
                source: path.basename(filePath),
                fileType: 'txt'
            }
        }];
    }

    // 处理PDF文件
    async processPdf(filePath) {
        return new Promise((resolve, reject) => {
            this.pdfExtract.extract(filePath, {}, (err, data) => {
                if (err) {
                    reject(err);
                    return;
                }

                const chunks = [];
                let currentPage = '';
                
                data.pages.forEach((page, pageIndex) => {
                    const pageText = page.content
                        .map(item => item.str)
                        .join(' ')
                        .trim();
                    
                    if (pageText) {
                        chunks.push({
                            type: 'text',
                            content: pageText,
                            metadata: {
                                source: path.basename(filePath),
                                fileType: 'pdf',
                                page: pageIndex + 1,
                                totalPages: data.pages.length
                            }
                        });
                    }
                });
                
                resolve(chunks);
            });
        });
    }

    // 处理Excel文件
    async processExcel(filePath) {
        const buffer = await fs.readFile(filePath);
        const workbook = XLSX.read(buffer);
        const chunks = [];

        workbook.SheetNames.forEach(sheetName => {
            const worksheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
            
            // 转换为文本描述
            const headers = jsonData[0] || [];
            const rows = jsonData.slice(1);
            
            let content = `工作表: ${sheetName}\n`;
            content += `列名: ${headers.join(', ')}\n`;
            content += `数据行数: ${rows.length}\n\n`;
            
            // 样本数据
            const sampleRows = rows.slice(0, 5);
            sampleRows.forEach((row, index) => {
                content += `第${index + 1}行: `;
                headers.forEach((header, colIndex) => {
                    if (row[colIndex] !== undefined) {
                        content += `${header}: ${row[colIndex]}, `;
                    }
                });
                content += '\n';
            });

            chunks.push({
                type: 'structured_data',
                content: content,
                rawData: { headers, rows: rows.slice(0, 100) }, // 限制原始数据大小
                metadata: {
                    source: path.basename(filePath),
                    fileType: 'excel',
                    sheet: sheetName,
                    totalRows: rows.length,
                    columns: headers.length
                }
            });
        });

        return chunks;
    }

    // 处理CSV文件
    async processCsv(filePath) {
        const content = await fs.readFile(filePath, 'utf-8');
        const lines = content.split('\n').filter(line => line.trim());
        
        if (lines.length === 0) return [];

        const headers = lines[0].split(',').map(h => h.trim());
        const dataRows = lines.slice(1);

        let textContent = `CSV文件: ${path.basename(filePath)}\n`;
        textContent += `列名: ${headers.join(', ')}\n`;
        textContent += `数据行数: ${dataRows.length}\n\n`;

        // 添加样本数据
        const sampleRows = dataRows.slice(0, 10);
        sampleRows.forEach((row, index) => {
            const values = row.split(',').map(v => v.trim());
            textContent += `第${index + 1}行: `;
            headers.forEach((header, colIndex) => {
                if (values[colIndex]) {
                    textContent += `${header}: ${values[colIndex]}, `;
                }
            });
            textContent += '\n';
        });

        return [{
            type: 'structured_data',
            content: textContent,
            rawData: { headers, rows: dataRows.slice(0, 1000) },
            metadata: {
                source: path.basename(filePath),
                fileType: 'csv',
                totalRows: dataRows.length,
                columns: headers.length
            }
        }];
    }

    // 处理Markdown文件
    async processMarkdown(filePath) {
        const content = await fs.readFile(filePath, 'utf-8');
        
        // 按标题分割
        const sections = this.splitMarkdownBySections(content);
        
        return sections.map((section, index) => ({
            type: 'markdown',
            content: section.content,
            metadata: {
                source: path.basename(filePath),
                fileType: 'markdown',
                section: index + 1,
                title: section.title || `Section ${index + 1}`
            }
        }));
    }

    // 按Markdown标题分割
    splitMarkdownBySections(content) {
        const lines = content.split('\n');
        const sections = [];
        let currentSection = { title: '', content: '' };
        
        for (const line of lines) {
            if (line.match(/^#{1,6}\s/)) {
                // 新的标题
                if (currentSection.content.trim()) {
                    sections.push(currentSection);
                }
                currentSection = {
                    title: line.replace(/^#{1,6}\s/, ''),
                    content: line + '\n'
                };
            } else {
                currentSection.content += line + '\n';
            }
        }
        
        if (currentSection.content.trim()) {
            sections.push(currentSection);
        }
        
        return sections;
    }

    // 处理JSON文件
    async processJson(filePath) {
        const content = await fs.readFile(filePath, 'utf-8');
        const data = JSON.parse(content);
        
        // 将JSON转换为可读的文本描述
        const textContent = this.jsonToText(data, path.basename(filePath));
        
        return [{
            type: 'structured_data',
            content: textContent,
            rawData: data,
            metadata: {
                source: path.basename(filePath),
                fileType: 'json'
            }
        }];
    }

    // JSON转文本描述
    jsonToText(obj, filename, indent = 0) {
        let text = `JSON文件: ${filename}\n\n`;
        text += this.objectToText(obj, indent);
        return text;
    }

    objectToText(obj, indent = 0) {
        const spaces = '  '.repeat(indent);
        let text = '';
        
        if (Array.isArray(obj)) {
            text += `${spaces}数组，包含 ${obj.length} 个元素:\n`;
            obj.slice(0, 5).forEach((item, index) => {
                text += `${spaces}  [${index}]: `;
                if (typeof item === 'object') {
                    text += '\n' + this.objectToText(item, indent + 2);
                } else {
                    text += `${item}\n`;
                }
            });
            if (obj.length > 5) {
                text += `${spaces}  ... 还有 ${obj.length - 5} 个元素\n`;
            }
        } else if (typeof obj === 'object' && obj !== null) {
            const keys = Object.keys(obj);
            text += `${spaces}对象，包含 ${keys.length} 个字段:\n`;
            keys.slice(0, 10).forEach(key => {
                text += `${spaces}  ${key}: `;
                if (typeof obj[key] === 'object') {
                    text += '\n' + this.objectToText(obj[key], indent + 2);
                } else {
                    text += `${obj[key]}\n`;
                }
            });
            if (keys.length > 10) {
                text += `${spaces}  ... 还有 ${keys.length - 10} 个字段\n`;
            }
        } else {
            text += `${spaces}${obj}\n`;
        }
        
        return text;
    }

    // 图片处理（使用GPT-4V）
    async processImage(imagePath, description = '') {
        try {
            const imageBuffer = await fs.readFile(imagePath);
            const base64Image = imageBuffer.toString('base64');
            
            const response = await this.openai.chat.completions.create({
                model: "gpt-4-vision-preview",
                messages: [
                    {
                        role: "user",
                        content: [
                            {
                                type: "text",
                                text: description || "请详细描述这张图片的内容，包括所有可见的文字、图表、数据等信息。"
                            },
                            {
                                type: "image_url",
                                image_url: {
                                    url: `data:image/jpeg;base64,${base64Image}`
                                }
                            }
                        ]
                    }
                ],
                max_tokens: 1000
            });

            const imageDescription = response.choices[0].message.content;
            
            return [{
                type: 'image',
                content: imageDescription,
                metadata: {
                    source: path.basename(imagePath),
                    fileType: 'image',
                    originalDescription: description
                }
            }];
        } catch (error) {
            console.error('图片处理失败:', error);
            return [{
                type: 'image',
                content: `图片文件: ${path.basename(imagePath)} - 处理失败`,
                metadata: {
                    source: path.basename(imagePath),
                    fileType: 'image',
                    error: error.message
                }
            }];
        }
    }
}