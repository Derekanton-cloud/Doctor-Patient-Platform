const Prescription = require("../models/prescription");
const Patient = require("../models/patient");
const Doctor = require("../models/doctor");

// Create a new prescription (Doctors only)
exports.createPrescription = async (req, res) => {
  try {
    const { patientId, diagnosis, medications, notes } = req.body;

    // Ensure patient exists
    const patient = await Patient.findById(patientId);
    if (!patient) return res.status(404).json({ error: "Patient not found" });

    const prescription = new Prescription({
      patient: patientId,
      doctor: req.user._id,
      diagnosis,
      medications,
      notes,
    });

    await prescription.save();

    res.status(201).json({ message: "Prescription created successfully", prescription });
  } catch (error) {
    console.error("Error creating prescription:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Get a specific prescription by ID (Accessible by Patient or Doctor)
exports.getPrescriptionById = async (req, res) => {
  try {
    const { prescriptionId } = req.params;

    const prescription = await Prescription.findById(prescriptionId)
      .populate("doctor", "firstName lastName specialization")
      .populate("patient", "firstName lastName");

    if (!prescription) return res.status(404).json({ error: "Prescription not found" });

    // Ensure access control: Only the doctor or patient can access
    if (
      (req.user.role === "patient" && prescription.patient._id.toString() !== req.user._id.toString()) ||
      (req.user.role === "doctor" && prescription.doctor._id.toString() !== req.user._id.toString())
    ) {
      return res.status(403).json({ error: "Access denied" });
    }

    res.status(200).json({ prescription });
  } catch (error) {
    console.error("Error fetching prescription:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Get all prescriptions for a specific patient (Patients only)
exports.getPrescriptionsByPatient = async (req, res) => {
  try {
    const prescriptions = await Prescription.find({ patient: req.user._id })
      .populate("doctor", "firstName lastName specialization");

    res.status(200).json({ prescriptions });
  } catch (error) {
    console.error("Error fetching patient prescriptions:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Get all prescriptions by a doctor (Doctors only)
exports.getPrescriptionsByDoctor = async (req, res) => {
  try {
    const prescriptions = await Prescription.find({ doctor: req.user._id })
      .populate("patient", "firstName lastName");

    res.status(200).json({ prescriptions });
  } catch (error) {
    console.error("Error fetching doctor prescriptions:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Update a prescription (Doctors only)
exports.updatePrescription = async (req, res) => {
  try {
    const { prescriptionId } = req.params;
    const { diagnosis, medications, notes } = req.body;

    const prescription = await Prescription.findOneAndUpdate(
      { _id: prescriptionId, doctor: req.user._id },
      { diagnosis, medications, notes },
      { new: true }
    );

    if (!prescription) return res.status(404).json({ error: "Prescription not found or unauthorized" });

    res.status(200).json({ message: "Prescription updated successfully", prescription });
  } catch (error) {
    console.error("Error updating prescription:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Delete a prescription (Doctors only)
exports.deletePrescription = async (req, res) => {
  try {
    const { prescriptionId } = req.params;

    const prescription = await Prescription.findOneAndDelete({
      _id: prescriptionId,
      doctor: req.user._id,
    });

    if (!prescription) return res.status(404).json({ error: "Prescription not found or unauthorized" });

    res.status(200).json({ message: "Prescription deleted successfully" });
  } catch (error) {
    console.error("Error deleting prescription:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
