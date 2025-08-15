export class PDFService {
  async extractTextFromPDF(file: File): Promise<string> {
    const formData = new FormData();
    formData.append('pdf', file);

    try {
      const response = await fetch('/api/parse-pdf', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error(`PDF parsing failed: ${response.status}`);
      }

      const data = await response.json();
      return data.text;
    } catch (error) {
      console.error('PDF extraction error:', error);
      throw new Error('无法解析PDF文件，请确保文件格式正确');
    }
  }

  async extractTextFromFile(file: File): Promise<string> {
    const fileType = file.type;
    const fileName = file.name.toLowerCase();

    if (fileType === 'application/pdf' || fileName.endsWith('.pdf')) {
      return this.extractTextFromPDF(file);
    } else if (fileType === 'text/plain' || fileName.endsWith('.txt')) {
      return this.readTextFile(file);
    } else {
      throw new Error('不支持的文件格式，请上传PDF或TXT文件');
    }
  }

  private readTextFile(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        resolve(text);
      };
      reader.onerror = (error) => {
        reject(new Error('读取文件失败'));
      };
      reader.readAsText(file, 'UTF-8');
    });
  }
}

const pdfService = new PDFService();
export default pdfService;