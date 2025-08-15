import React, { useState, useEffect } from 'react';
import { X, Briefcase } from 'lucide-react';

interface JobSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  jobDescription: string;
  onSave: (description: string) => void;
}

const JobSettingsModal: React.FC<JobSettingsModalProps> = ({
  isOpen,
  onClose,
  jobDescription,
  onSave
}) => {
  const [description, setDescription] = useState(jobDescription);

  useEffect(() => {
    setDescription(jobDescription);
  }, [jobDescription]);

  if (!isOpen) return null;

  const handleSave = () => {
    onSave(description);
    localStorage.setItem('jobDescription', description);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-[600px] max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <Briefcase size={20} />
            <h2 className="text-xl font-bold">设置岗位描述</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
          >
            <X size={20} />
          </button>
        </div>
        
        <div className="p-4 flex-1 overflow-auto">
          <label className="block mb-2 text-sm font-medium text-gray-700">
            岗位描述和要求
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="请输入岗位名称、职责描述、技能要求等信息..."
            className="w-full h-64 p-3 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="mt-2 text-sm text-gray-500">
            岗位描述将用于生成更精准的面试问题和评估标准
          </p>
        </div>
        
        <div className="flex justify-end gap-3 p-4 border-t">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
};

export default JobSettingsModal;