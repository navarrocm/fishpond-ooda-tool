// Add this import at the top
import { 
  showTab, showMessage, renderPondList, showPondDetail, 
  showAddPondModal, updateSelectors, renderAnalysis, renderHarvestList,
  renderDecide  // <-- Add this
} from './ui.js';

// Add this to the tab navigation event listener
if (tab === 'decide') {
  await updateSelectors();
  const pondId = document.getElementById('decide-pond')?.value;
  await renderDecide(pondId);
}

// Add this event listener for the decide pond selector
document.getElementById('decide-pond')?.addEventListener('change', async (e) => {
  const pondId = e.target.value;
  await renderDecide(pondId);
});

// Add this to the updateSelectors function call in init()
await updateSelectors(); // This already updates all selectors including decide-pond
