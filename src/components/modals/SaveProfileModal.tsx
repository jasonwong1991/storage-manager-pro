import React, { useState } from 'react';
import { useLanguage } from '../../hooks/useLanguage';
import { useCustomDialog } from '../../hooks/useCustomDialog';
import { ProfileService } from '../../services/profile.service';
import { StorageService } from '../../services/storage.service';
import { CookieService } from '../../services/cookie.service';
import { BaseModal } from './BaseModal';
import { CustomAlert } from '../common/CustomAlert';
import { CustomConfirm } from '../common/CustomConfirm';

interface SaveProfileModalProps {
  onClose: () => void;
  onSaved: () => void;
  currentDomain: string;
}

export const SaveProfileModal: React.FC<SaveProfileModalProps> = ({
  onClose,
  onSaved,
  currentDomain,
}) => {
  const { t } = useLanguage();
  const { alertState, showAlert, hideAlert, confirmState, showConfirm, hideConfirm } = useCustomDialog();
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    includeLocalStorage: true,
    includeCookies: true,
  });
  const [saving, setSaving] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;

    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      showAlert(t('profile_name_required'), { type: 'warning' });
      return;
    }

    if (!currentDomain) {
      showAlert(t('domain_required_for_profile'), { type: 'warning' });
      return;
    }

    if (!formData.includeLocalStorage && !formData.includeCookies) {
      showAlert(t('select_at_least_one_content_type'), { type: 'warning' });
      return;
    }

    // 检查配置文件名称是否已存在
    try {
      const existingProfiles = await ProfileService.getProfileList();
      const duplicateProfile = existingProfiles.find(profile => profile.name === formData.name.trim());

      if (duplicateProfile) {
        // 生成唯一名称建议
        const baseName = formData.name.trim();
        let counter = 1;
        let suggestedName = `${baseName} (${counter})`;

        while (existingProfiles.find(profile => profile.name === suggestedName)) {
          counter++;
          suggestedName = `${baseName} (${counter})`;
        }

        await showConfirm(
          t('profile_name_exists', { name: formData.name.trim(), suggested: suggestedName }),
          () => {
            setFormData(prev => ({ ...prev, name: suggestedName }));
          },
          {
            type: 'warning',
            confirmText: t('use_suggested_name'),
            cancelText: t('keep_current_name')
          }
        );
        return;
      }
    } catch (error) {
      console.error('Failed to check existing profiles:', error);
    }

    setSaving(true);
    try {
      const profileData: any = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        domain: currentDomain,
        timestamp: new Date().toISOString(),
        includeLocalStorage: formData.includeLocalStorage,
        includeCookies: formData.includeCookies,
      };

      // 收集数据
      if (formData.includeLocalStorage) {
        try {
          const localStorageData = await StorageService.getLocalStorage(currentDomain);
          profileData.localStorage = localStorageData;
        } catch (error) {
          console.error('Failed to get localStorage data:', error);
        }
      }

      if (formData.includeCookies) {
        try {
          const cookiesData = await CookieService.getCookies(currentDomain);
          profileData.cookies = cookiesData;
        } catch (error) {
          console.error('Failed to get cookies data:', error);
        }
      }

      // 构造GlobalProfileData格式
      const globalProfileData = {
        domains: {
          [currentDomain]: {
            domain: currentDomain,
            localStorage: profileData.localStorage || {},
            sessionStorage: {},
            cookies: profileData.cookies || [],
            timestamp: Date.now(),
          },
        },
        accounts: {},
        backups: {},
        metadata: {
          version: '2.0.0',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          totalDomains: 1,
          totalAccounts: 0,
          totalBackups: 0,
        },
      };

      await ProfileService.saveProfile(profileData.name, globalProfileData);
      onSaved();
    } catch (error) {
      console.error('Failed to save profile:', error);
      showAlert(t('save_profile_error'), { type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const footer = (
    <>
      <button className="btn btn-secondary" onClick={onClose} disabled={saving}>
        {t('cancel')}
      </button>
      <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
        {saving ? t('saving') : t('save_config')}
      </button>
    </>
  );

  return (
    <BaseModal
      isOpen={true}
      onClose={onClose}
      title={t('save_profile')}
      footer={footer}
    >
      <div className="form-group">
        <label htmlFor="profileName">{t('profile_name')}</label>
        <input
          type="text"
          id="profileName"
          name="name"
          className="form-control"
          value={formData.name}
          onChange={handleInputChange}
          placeholder={t('profile_name_placeholder')}
          disabled={saving}
        />
      </div>

      <div className="form-group">
        <label htmlFor="profileDescription">{t('profile_description')}</label>
        <textarea
          id="profileDescription"
          name="description"
          className="form-control"
          rows={3}
          value={formData.description}
          onChange={handleInputChange}
          placeholder={t('profile_description_placeholder')}
          disabled={saving}
        />
      </div>

      <div className="form-group">
        <label>{t('include_content')}</label>
        <div className="checkbox-group">
          <label>
            <input
              type="checkbox"
              name="includeLocalStorage"
              checked={formData.includeLocalStorage}
              onChange={handleInputChange}
              disabled={saving}
            />
            LocalStorage
          </label>
          <label>
            <input
              type="checkbox"
              name="includeCookies"
              checked={formData.includeCookies}
              onChange={handleInputChange}
              disabled={saving}
            />
            Cookies
          </label>
        </div>
      </div>

      {currentDomain && (
        <div className="form-group">
          <label>{t('current_domain')}</label>
          <div className="domain-display">{currentDomain}</div>
        </div>
      )}

      {/* Custom Dialogs */}
      <CustomAlert
        isOpen={alertState.isOpen}
        title={alertState.title}
        message={alertState.message}
        type={alertState.type}
        onClose={hideAlert}
      />

      <CustomConfirm
        isOpen={confirmState.isOpen}
        title={confirmState.title}
        message={confirmState.message}
        type={confirmState.type}
        confirmText={confirmState.confirmText}
        cancelText={confirmState.cancelText}
        onConfirm={confirmState.onConfirm || (() => {})}
        onCancel={confirmState.onCancel || hideConfirm}
      />
    </BaseModal>
  );
};
