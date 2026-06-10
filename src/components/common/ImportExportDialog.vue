<script setup lang="ts">
import { ref, computed } from "vue";
import { useExport, type ExportFormat } from "@/composables/useExport";
import {
  useImport,
  type ImportFormat,
  type ImportResult,
} from "@/composables/useImport";
import Dialog from "primevue/dialog";
import Button from "primevue/button";
import TabView from "primevue/tabview";
import TabPanel from "primevue/tabpanel";
import Select from "primevue/select";
import FileUpload from "primevue/fileupload";
import ProgressBar from "primevue/progressbar";
import Message from "primevue/message";
import DataTable from "primevue/datatable";
import Column from "primevue/column";

const props = defineProps<{
  visible: boolean;
  entityName: string;
  data: Record<string, unknown>[];
  exportFields?: string[];
  importRequiredFields?: string[];
  importTransform?: (row: Record<string, unknown>) => Record<string, unknown>;
}>();

const emit = defineEmits<{
  (e: "update:visible", value: boolean): void;
  (e: "import", data: unknown[]): void;
}>();

const { exporting, exportData } = useExport();
const { importing, progress, importFromFile } = useImport();

const activeTab = ref(0);
const exportFormat = ref<ExportFormat>("json");
const importFormat = ref<ImportFormat>("json");
const importResult = ref<ImportResult<unknown> | null>(null);
const selectedFile = ref<File | null>(null);

interface ErrorRow {
  row: number | string;
  message: string;
}

const formatOptions = [
  { label: "JSON", value: "json" },
  { label: "CSV", value: "csv" },
  { label: "Excel (.xlsx)", value: "excel" },
];

const importErrors = ref<ErrorRow[]>([]);

const exportFormatOptions = [...formatOptions, { label: "XML", value: "xml" }];

const canExport = computed(() => props.data.length > 0);

async function handleExport() {
  const filename = `${props.entityName.toLowerCase().replace(/\s+/g, "-")}-export-${Date.now()}`;
  await exportData(props.data, {
    filename,
    format: exportFormat.value,
    fields: props.exportFields,
    includeHeaders: true,
  });
}

function handleFileSelect(event: { files: File[] }) {
  selectedFile.value = event.files[0] || null;
  importResult.value = null;
}

async function handleImport() {
  if (!selectedFile.value) return;

  const result = await importFromFile(selectedFile.value, {
    format: importFormat.value,
    requiredFields: props.importRequiredFields,
    transformRow: props.importTransform,
  });

  importResult.value = result;

  // Parse errors into row/message pairs for the DataTable
  importErrors.value = result.errors.map((err) => {
    const match = err.match(/^Row (\d+): (.+)$/);
    if (match) {
      return { row: parseInt(match[1]), message: match[2] };
    }
    return { row: "—", message: err };
  });

  if (result.data.length > 0) {
    emit("import", result.data);
  }
}

function closeDialog() {
  emit("update:visible", false);
  importResult.value = null;
  selectedFile.value = null;
  importErrors.value = [];
}

function getResultSeverity(): "success" | "warn" | "error" {
  if (!importResult.value) return "success";
  if (importResult.value.errors.length === 0) return "success";
  if (importResult.value.validRows > 0) return "warn";
  return "error";
}
</script>

<template>
  <Dialog
    :visible="visible"
    header="Import / Export"
    :style="{ width: '550px' }"
    modal
    @update:visible="$emit('update:visible', $event)"
  >
    <TabView v-model:activeIndex="activeTab">
      <!-- Export Tab -->
      <TabPanel header="Export" value="export">
        <div class="tab-content">
          <div class="info-text">
            Export {{ data.length }} {{ entityName.toLowerCase() }}(s) to a
            file.
          </div>

          <div class="form-field">
            <label>Export Format</label>
            <Select
              v-model="exportFormat"
              :options="exportFormatOptions"
              option-label="label"
              option-value="value"
              class="w-full"
            />
          </div>

          <div class="format-info">
            <template v-if="exportFormat === 'json'">
              <i class="pi pi-info-circle"></i>
              JSON format preserves all data types and nested structures.
            </template>
            <template v-else-if="exportFormat === 'csv'">
              <i class="pi pi-info-circle"></i>
              CSV format is compatible with spreadsheet applications.
            </template>
            <template v-else-if="exportFormat === 'xml'">
              <i class="pi pi-info-circle"></i>
              XML format is suitable for system integrations.
            </template>
          </div>

          <Button
            label="Export"
            icon="pi pi-download"
            :loading="exporting"
            :disabled="!canExport"
            @click="handleExport"
            class="w-full"
          />
        </div>
      </TabPanel>

      <!-- Import Tab -->
      <TabPanel header="Import" value="import">
        <div class="tab-content">
          <div class="info-text">
            Import {{ entityName.toLowerCase() }}s from a file.
          </div>

          <div class="form-field">
            <label>Import Format</label>
            <Select
              v-model="importFormat"
              :options="formatOptions"
              option-label="label"
              option-value="value"
              class="w-full"
            />
          </div>

          <div class="form-field">
            <label>Select File</label>
            <FileUpload
              mode="basic"
              :accept="
                importFormat === 'json'
                  ? '.json'
                  : importFormat === 'excel'
                    ? '.xlsx'
                    : '.csv'
              "
              :max-file-size="10000000"
              choose-label="Choose File"
              :auto="false"
              @select="handleFileSelect"
              class="w-full"
            />
            <small v-if="importFormat === 'excel'" class="format-hint">
              Only the first worksheet will be imported.
            </small>
          </div>

          <ProgressBar
            v-if="importing"
            :value="progress"
            :show-value="true"
            class="import-progress"
          />

          <Message
            v-if="importResult"
            :severity="getResultSeverity()"
            :closable="false"
          >
            <template v-if="importResult.errors.length === 0">
              Successfully imported {{ importResult.validRows }} of
              {{ importResult.totalRows }} rows.
            </template>
            <template v-else>
              Imported {{ importResult.validRows }} of
              {{ importResult.totalRows }} rows.
              {{ importResult.errors.length }} row(s) had errors — see below.
            </template>
          </Message>

          <div v-if="importErrors.length > 0" class="error-table-wrapper">
            <div class="error-table-header">Import Errors</div>
            <DataTable
              :value="importErrors"
              size="small"
              scrollable
              scroll-height="200px"
            >
              <Column field="row" header="Row" style="width: 80px" />
              <Column field="message" header="Message" />
            </DataTable>
          </div>

          <Button
            label="Import"
            icon="pi pi-upload"
            :loading="importing"
            :disabled="!selectedFile"
            @click="handleImport"
            class="w-full"
          />
        </div>
      </TabPanel>
    </TabView>

    <template #footer>
      <Button label="Close" text @click="closeDialog" />
    </template>
  </Dialog>
</template>

<style scoped>
.tab-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 8px 0;
}

.info-text {
  color: var(--text-color-secondary);
  font-size: 0.875rem;
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-field label {
  font-weight: 500;
  font-size: 0.875rem;
}

.w-full {
  width: 100%;
}

.format-info {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  background: var(--surface-ground);
  border-radius: 6px;
  font-size: 0.875rem;
  color: var(--text-color-secondary);
}

.format-info i {
  color: var(--primary-color);
}

.import-progress {
  height: 8px;
}

.format-hint {
  color: var(--text-color-secondary);
  font-size: 0.8rem;
}

.error-table-wrapper {
  border: 1px solid var(--surface-border);
  border-radius: 6px;
  overflow: hidden;
}

.error-table-header {
  padding: 8px 12px;
  font-size: 0.875rem;
  font-weight: 600;
  background: var(--surface-ground);
  border-bottom: 1px solid var(--surface-border);
  color: var(--red-600);
}
</style>
