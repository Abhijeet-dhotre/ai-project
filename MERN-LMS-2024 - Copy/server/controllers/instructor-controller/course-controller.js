const Course = require("../../models/Course");
const CourseProgress = require("../../models/CourseProgress");
const StudentCourses = require("../../models/StudentCourses");
const { deleteMediaFromCloudinary } = require("../../helpers/cloudinary");

const addNewCourse = async (req, res) => {
  try {
    const courseData = req.body;
    const newlyCreatedCourse = new Course(courseData);
    const saveCourse = await newlyCreatedCourse.save();

    if (saveCourse) {
      res.status(201).json({
        success: true,
        message: "Course saved successfully",
        data: saveCourse,
      });
    }
  } catch (e) {
    console.log(e);
    res.status(500).json({
      success: false,
      message: "Some error occured!",
    });
  }
};

const getAllCourses = async (req, res) => {
  try {
    const coursesList = await Course.find({});

    res.status(200).json({
      success: true,
      data: coursesList,
    });
  } catch (e) {
    console.log(e);
    res.status(500).json({
      success: false,
      message: "Some error occured!",
    });
  }
};

const getCourseDetailsByID = async (req, res) => {
  try {
    const { id } = req.params;
    const courseDetails = await Course.findById(id);

    if (!courseDetails) {
      return res.status(404).json({
        success: false,
        message: "Course not found!",
      });
    }

    res.status(200).json({
      success: true,
      data: courseDetails,
    });
  } catch (e) {
    console.log(e);
    res.status(500).json({
      success: false,
      message: "Some error occured!",
    });
  }
};

const updateCourseByID = async (req, res) => {
  try {
    const { id } = req.params;
    const updatedCourseData = req.body;

    const updatedCourse = await Course.findByIdAndUpdate(
      id,
      updatedCourseData,
      { new: true }
    );

    if (!updatedCourse) {
      return res.status(404).json({
        success: false,
        message: "Course not found!",
      });
    }

    res.status(200).json({
      success: true,
      message: "Course updated successfully",
      data: updatedCourse,
    });
  } catch (e) {
    console.log(e);
    res.status(500).json({
      success: false,
      message: "Some error occured!",
    });
  }
};

const deleteCourseByID = async (req, res) => {
  try {
    const { id } = req.params;

    const courseToDelete = await Course.findById(id);

    if (!courseToDelete) {
      return res.status(404).json({
        success: false,
        message: "Course not found!",
      });
    }

    // 1. Delete associated media (lectures) from Cloudinary
    const deleteMediaPromises = courseToDelete.curriculum.map((lecture) => {
      if (lecture.public_id) {
        return deleteMediaFromCloudinary(lecture.public_id);
      }
      return Promise.resolve();
    });

    await Promise.all(deleteMediaPromises);

    // 2. Delete all CourseProgress documents related to this course
    await CourseProgress.deleteMany({ courseId: id });

    // 3. Remove the course from all StudentCourses documents
    await StudentCourses.updateMany(
      { "courses.courseId": id },
      { $pull: { courses: { courseId: id } } }
    );

    // 4. Delete the Course document itself
    await Course.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: "Course deleted successfully, along with associated data!",
    });
  } catch (e) {
    console.log(e);
    
    // THIS IS THE CORRECTED LINE:
    res.status(500).json({
      success: false,
      message: "Error deleting course!",
    });
  }
};

module.exports = {
  addNewCourse,
  getAllCourses,
  updateCourseByID,
  getCourseDetailsByID,
  deleteCourseByID,
};
