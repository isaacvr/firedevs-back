const NeDB = require('nedb');
const validator = require('email-validator');
const Moment = require('moment');

let Student = new NeDB({ filename: __dirname + '/database/student.db', autoload: true });
let Group = new NeDB({ filename: __dirname + '/database/group.db', autoload: true });

let router = require('express').Router();

const inRange = (v, a, b) => v >= a && v < b;

const StudentSchema = {
  age: (age) => inRange(age, 18, 28),
  sex: (sex) => [ 'Male', 'Female' ].indexOf(sex) > -1,
  name: (name) => !!name,
  email: validator.validate,
  bornDate: (date) => {
    let a = Moment(+date);
    let b = Moment(Date.now());
    
    if ( a.isValid() && b.isValid() ) {
      return inRange( b.diff(a, 'years'), 18, 28 );
    }

    return false;
  },
  city: (city) => !!city,
  group: (group) => !!group,
};

const GroupSchema = {
  name: (name) => !!name,
  teacher: (teacher) => !!teacher
};

/// GET
router.get('/students', function(req, res) {
  Student.find({}, (err, students) => {
    err && res.status(500).json({ message: "Error getting students." });
    !err && res.status(200).json(students);
  });
});

router.get('/student/:email', function(req, res) {
  Student.findOne({
    email: req.params.email
  }, (err, student) => {
    err && res.status(500).json({ message: "Error getting student." });
    !err && res.status(student ? 200 : 404).json(student || { message: "User not found." });
  });
});

// Load all student full-related data
router.get('/studentsf', function(req, res) {
  Student.find({}, (err, students) => {
    if ( err ) {
      return res.status(500).json({ message: "Error getting students." });
    }
    
    students.sort((a, b) => a.group < b.group ? -1 : 1 );

    Group.find({}, function(err, groups) {
      if ( err ) {
        return res.status(202).json(students);
      }

      groups.sort((a, b) => a._id < b._id ? -1 : 1 );

      for(let i = 0, maxi = students.length; i < maxi; i += 1) {
        let ini = 0, fin = groups.length;
        let sg = students[i].group;

        students[i].group = {
          _id: "", name: "", teacher: ""
        };

        while(ini < fin) {
          let mid = ~~((ini + fin) / 2);
          if ( groups[mid]._id === sg ) {
            students[i].group = Object.assign({}, groups[mid]);
            break;
          } else if (  groups[mid]._id < sg ) {
            ini = mid + 1;
          } else {
            fin = mid;
          }
        }
      }

      return res.status(200).json(students);
    });
  });
});

router.get('/studentf/:email', function(req, res) {
  Student.findOne({
    email: req.params.email
  }, (err, student) => {
    if ( err ) {
      return res.status(500).json({ message: "Error getting student." });
    }
    
    if ( !student ) {
      return res.status(404).jsonp({ message: "Student not found." });
    }

    Group.findOne({ _id: student }, function(err, group) {
      if ( err || !group ) {
        student.group = { _id: "", name: "", teacher: "" };
        return res.status(202).json(student);
      }

      student.group = group;
      return res.status(200).json(student);
    });

  });
});

router.get('/groups', function(req, res) {
  Group.find({}, (err, groups) => {
    if ( err ) {
      return res.status(500).json({ message: "Error getting groups." });
    }
    return res.status(200).json(groups);
  });
});

router.get('/group/:id', function(req, res) {
  Group.findOne({
    _id: req.params.id
  }, (err, group) => {
    if ( err ) {
      return res.status(500).json({ message: "Error getting groups." });
    }

    if ( !group ) {
      return res.status(404).json({ message: "Group not found." });
    }

    return res.status(200).json(group);
  });
});

router.get('/groupsf', function(req, res) {
  Group.find({}, (err, groups) => {
    if ( err ) {
      return res.status(500).json({ message: "Error getting groups." });
    }

    groups.sort((a, b) => a._id < b._id ? -1 : 1 );

    Student.find({}, function(err1, students) {
      if ( err1 ) {
        return res.status(500).json({ message: "Error getting students." });
      }

      students.sort((a, b) => a.group < b.group ? -1 : 1 );

      for(let i = 0, maxi = students.length; i < maxi; i += 1) {
        let ini = 0, fin = groups.length;

        while(ini < fin) {
          let mid = ~~((ini + fin) / 2);
          if ( groups[mid]._id === students[i].group ) {
            groups[mid].students = groups[mid].students || [];
            groups[mid].students.push(students[i]);
            break;
          } else if (  groups[mid]._id < students[i].group ) {
            ini = mid + 1;
          } else {
            fin = mid;
          }
        }
      }

      return res.status(200).json(groups);

    });
  });
});

router.get('/groupf/:id', function(req, res) {
  Group.findOne({
    _id: req.params.id
  }, (err, group) => {
    if ( err ) {
      return res.status(500).json({ message: "Error getting groups." });
    }

    if ( !group ) {
      return res.status(404).json({ message: "Group not found." });
    }

    Student.find({
      group: group._id
    }, function(err1, students) {
      if ( err1 ) {
        return res.status(500).json({ message: "Error getting students." });
      }
      group.students = students;
      res.status(200).json(group);
    });
  });
});

/// POST
router.post('/student', function(req, res) {
  let body = req.body || {};
  let student = {};

  for(let field in StudentSchema) {
    if ( !StudentSchema[field](body[field]) ) {
      return res.status(400).json({ message: "Invalid field " + field + '.' });
    }
    student[field] = body[field];
  }

  Student.insert(student, (err, doc) => {
    res.status(err ? 500 : 200).json(err ? { message: "Couldn't save the student." } : doc);
  });

});

router.post('/group', function(req, res) {
  let body = req.body;
  let group = {};
  
  for(let field in GroupSchema) {
    if ( !GroupSchema[field](body[field]) ) {
      return res.status(400).json({ message: "Invalid field " + field + "." });
    }
    group[field] = body[field];
  }

  Group.insert(group, (err, doc) => {
    res.status(err ? 500 : 200).json(err ? { message: "Couldn't save the group." } : doc);
  });

});

/// PUT
router.put('/student/:email', function(req, res) {
  let email = req.params.email;
  let body = req.body;

  Student.findOne({ email }, (err, student) => {
    if ( err ) {
      return res.status(500).json({ message: "Unknown error. Please retry later." });
    }

    if ( !student ) {
      return res.status(404).json({ message: "Student not found." });
    }

    Student.update({ email }, { $set: body }, {}, function(err) {
      if ( err ) {
        return res.status(500).json({ message: "Couldn't update this student." });
      }

      return res.status(200).json({ message: "Student updated!" });
    });
  });
});

router.put('/group/:id', function(req, res) {
  let _id = req.params.id;
  let body = req.body;

  Group.findOne({ _id }, (err, group) => {
    if ( err ) {
      return res.status(500).json({ message: "Unknown error. Please retry later." });
    }

    if ( !group ) {
      return res.status(404).json({ message: "Group not found." });
    }

    Group.update({ _id }, { $set: body }, {}, function(err) {
      if ( err ) {
        return res.status(500).json({ message: "Couldn't update this group." });
      }

      return res.status(200).json({ message: "Group updated!" });
    });
  });
});

/// DELETE
router.delete('/student/:email', function(req, res) {
  Student.remove({
    email: req.params.email
  }, function(err) {
    err && res.status(500).json({ message: "Server error. Couldn't delete the student." });
    !err && res.status(200).json({ message: "User deleted successfully" });
  });
});

router.delete('/group/:id', function(req, res) {
  Group.remove({
    _id: req.params.id
  }, function(err) {
    err && res.status(500).json({ message: "Server error. Couldn't delete the group." });
    !err && res.status(200).json({ message: "Group deleted successfully" });
  });
});

router.all('*', function(req, res) {
  res.status(404).json({ message: "Invalid resource" });
})

module.exports = router;